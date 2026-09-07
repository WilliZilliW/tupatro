---
id: 2026-09-07-per-seat-economy
title: Give the roguelike economy a per-seat owner
kind: rule
status: proposed
source: Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022); <https://korttipeliopas.fi/tuppi> — tuppi has no economy at all; the money, jokers, vouchers and tuppipakka are Balatro's shell, so no rule of play moves here
---

# Give the roguelike economy a per-seat owner

## What

The roguelike wallet stops being the run's and becomes a seat's. A new `PlayerEconomy` record
holds the seventeen fields that are singular on `GameState` today — `money`, `jokers`,
`consumables`, `vouchers`, `jokerSlots`, `consSlots`, `shopSlots`, `chipBonus`, `tuppiBonus`,
`sideDeck`, `sideSlots`, `swaps`, `swapsLeft`, `usedSide`, `shop`, `shopAfterBoss` and
`rerollCost` — and `GameState` carries `economies: [PlayerEconomy, PlayerEconomy, PlayerEconomy,
PlayerEconomy]` in their place. The five economy actions that carried no seat (`buy`, `reroll`,
`sellJoker`, `sellSideCard`, `useConsumable`) gain a `p: Seat`, guarded like every other
seat-carrying case, and the reducer charges `economies[action.p]`. Every pure function that needs a
wallet — `chipValue`, `tuppiInfo`, `scoreTrick`, `rollShopStock`, `anySwapAvailable` — takes the
seat whose wallet it is as a parameter and resolves it through one `econOf(g, p)`.

**Nothing resolves a wallet from a viewing seat.** There is no `myEcon(g)`: the pure core is not
allowed to learn who is looking, and `scoreTrick` is handed the _scoring side's_ inventory, not the
viewer's — a card's chip value that depended on which window was open would be a lockstep desync.

Nothing a player can see or do changes. Seat 0 owns everything, the other three wallets hold
nothing, and the engine's deal-by-deal output stays bit-identical: `game/seats.test.ts`'s pinned
literals for three named seeds and its fifty-seed aggregate must not move. The new capability is
for the developer only — the shell can now belong to a seat rather than to the run.

## Prior specs

- **Continues `2026-09-07-seat-absolute-game-state`** (in `main`; its front matter still says
  `proposed`, its code is shipped — `seats`, `tricks`, `sooliSeat`, `SAVE_VERSION` 2 are all in
  `main`). That spec listed under **Out of scope**: _"the run's money, target, jokers, side deck and
  banked score still belong to a single team"_. This spec is exactly that follow-up and reverses
  nothing in it. In particular it does **not** reintroduce the two fields it removed
  (`usTricks`/`themTricks`) nor put a viewing seat back on `GameState`; the new invariant cases sit
  beside its own.
- **Contradicts `main`'s standing note on `upgradeV1`, deliberately.** CLAUDE.md says of the v1→v2
  upgrade: _"Do not chain it. The next shape change either drops v1 or decides this again."_ This is
  that next shape change. The reading that wins: **v1 is dropped** — `upgradeV1`, its two lines in
  `rehydrate` and its five test cases are deleted — and a fresh, time-boxed `upgradeV2` is written
  in its place, so exactly one migration exists at a time and no chain forms. See Assumptions; a
  reviewer who wants the plain discard deletes one function and its tests.
- **Overlaps `2026-09-04-resume-a-run-after-a-refresh` (delivered).** `SAVE_VERSION` goes to 3 and
  the snapshot's shape changes: the economy fields move inside a per-seat record, and each seat's
  jokers, consumables and shop stock are stored by id. That spec's rule — the bump is the tool for a
  shape change — is followed.
- **Overlaps `2026-09-06-tuppipakka-swap-info-and-cancel` (delivered).** The swap's
  select-then-confirm shape, its infobox, its two reducer guards and their toasts are untouched;
  `SwapPanel` and `anySwapAvailable` only change _where_ `sideDeck`, `usedSide`, `swaps` and
  `swapsLeft` come from.
- **Overlaps `2026-09-06-discard-picker-when-storage-full` (delivered).** `ReplacePick` and the
  `replace` index keep their behaviour exactly; only the arrays they list come from a seat's wallet.
  The three "slots full" toasts stay the rule's authority.
- **Overlaps `2026-09-06-tuppi-rummikub-challenge` (delivered).** A challenge has no economy and
  must keep having none: `startChallenge`/`leaveChallenge` still replace the whole state, `parked`
  is still dropped from the snapshot, and no challenge code path reads `economies`.
- **Overlaps `2026-09-05-swipeable-rail-pages-on-phone` (delivered).** The rail's kit and support
  pages read the wallet, so their content is re-sourced — but no markup and no CSS may change, or
  the measured page heights in that spec stop holding.
- **Reference implementation, on another branch, not in this repo's `docs/specs/`:**
  `2026-09-05-multiplayer-economy-money.md`, `2026-09-05-multiplayer-economy-inventory.md` and
  `2026-09-07-multiplayer-economy-sidedeck.md` in the `multiplayer-mode` worktree
  (`~/projects/tupatro-mp`), commits `f4adb21`, `eb30caf`, `4a5f06d`. The `PlayerEconomy` shape, the
  `newEconomy()` factory, the `SavedEconomy` split in `save.ts` and the `splitEcon`/`withEcon` test
  fixtures are ported from there. Its `localSeat` field, its `myEcon(g)` helper, its `seatKind`
  naming and its `usTricks`/`themTricks` are **not** — `main` replaced all four on purpose — so
  every `myEcon(g)` in that reference becomes an explicit seat parameter here.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

### The shape

- [ ] `src/game/types.ts` declares `export type PlayerEconomy` with exactly the seventeen fields
      listed in **What**, and `GameState` carries a four-element tuple of it under `economies` and
      **none** of those seventeen at top level. A new case in `src/test/invariants.test.ts` reads
      the `GameState` block of `types.ts` and asserts no top-level field is named any of the
      seventeen.
- [ ] `createRun` in `src/game/state.ts` builds all four seats from one `newEconomy()` factory. The
      existing invariant _"defines every state field in createRun"_ is **extended** to scan the
      `PlayerEconomy` block as well and assert each of its seventeen fields is initialised in
      `state.ts`; without that extension the seventeen fields would leave the invariant's reach
      entirely. Shown to bite by adding a field to `PlayerEconomy` and not to `newEconomy()`
      (mutation output recorded in the PR body).
- [ ] `src/game/economy.ts` is new, is listed in `PURE_CORE` in `src/test/invariants.test.ts`, and
      exports exactly one function, taking the state and a seat and returning that seat's
      `PlayerEconomy`: `econOf(g, p)`. A grep for `myEcon`, `localSeat`, `seatKind`, `usTricks` and
      `themTricks` across `src/` finds nothing — the four things `main` replaced are not ported
      back.

### The seat on the action

- [ ] `buy`, `reroll`, `sellJoker`, `sellSideCard` and `useConsumable` in `src/game/actions.ts` each
      carry `p: Seat`. Each case in `src/game/reducer.ts` opens with a silent
      `if (d.seats[action.p] !== "human") return;` — **before** any toast, including
      `useConsumable`'s `temppukielto` toast, which keeps its position ahead of the phase guard —
      and reads and writes `d.economies[action.p]` and nothing else.
- [ ] `src/game/reducer.test.ts` asserts each of the five, dispatched with `p: 1` on a state where
      `seats[1] === "ai"`, returns a state deep-equal to the input (no money moved, no toast), and
      that a successful `buy` with `p: 0` changes `economies[0]` while `economies[1..3]` stay
      deep-equal to their `createRun` value.
- [ ] Every dispatch site passes the viewing seat from `useViewSeat()`:
      `src/components/screens/Shop.tsx` (both `buy` calls and `reroll`),
      `src/components/rail/JokerList.tsx` (`sellJoker`),
      `src/components/rail/SideDeckBox.tsx` (`sellSideCard`),
      `src/components/rail/ConsumablesBox.tsx` (`useConsumable`). `src/test/render.test.tsx`'s
      existing `toStrictEqual({ type: "buy", index: 0, replace: k })` assertions are updated to
      expect `p: 0` and a new assertion covers each of the other four payloads.

### The wallet arrives as a parameter, never as a viewer

- [ ] `chipValue`, `tuppiInfo`, `tuppiMult`, `finalScore`, `scoreTrick`, `rollShopStock` and
      `anySwapAvailable` each take the seat whose wallet they use and resolve it through `econOf`.
      No function under `src/game/` obtains a wallet any other way, and the delivered invariant
      _"keeps the context out of the core"_ (no `src/game/` file importing `seatContext` /
      `useSeat` / `SeatProvider`) still passes.
- [ ] `scoreTrick` is handed the **scoring side's** wallet: `ownerSeat(g)`, the seat on the team
      `scoresFor` picked, which is what `resolveTrick` already passes as `owner`. A new case in
      `src/game/scoring.test.ts` plays a **nolo** trick won by seat 1 and asserts the score is
      computed from seat 0's jokers and `chipBonus`, and is unchanged when seats 1–3 are given
      different jokers and a different `chipBonus`. A second case in `src/game/reducer.test.ts`
      resolves the same trick through `resolveTrick` and pins the banked `base` and `pop` to the
      owner's wallet, so the decision is guarded end to end and not only at the unit call. Shown
      to bite: with `econOf(g, owner)` in `scoreTrick` switched to `econOf(g, winnerSeat)`, both
      cases fail (mutation output recorded in the PR body). **The `seats.test.ts` golden is blind
      to this decision and must not be claimed as a guard for it**: `basicPolicy` never buys, so
      every wallet in every golden run holds no joker, no voucher, no side-deck card and
      `chipBonus` 0 — all four are indistinguishable, and the golden passes under the mutation.
      Giving the measured policy a purchase would make it sensitive and is refused here: it is in
      **Out of scope** ("no policy in `src/test/bot.ts` gains a purchase") and it would move every
      pinned literal, which is the one thing this spec forbids.
- [ ] `ScoreContext`'s `money` and `sideDeckEnh` are sourced from that same wallet, and
      `src/game/content.ts` is **unchanged** — no joker or voucher effect reads `economies`. The
      delivered `rules.test.ts` case asserting no effect reaches for game state still passes.
- [ ] `src/components/PlayingCard.tsx` calls `chipValue(g, useViewSeat(), card)`: the printed chip
      number is what the card is worth to the seat looking at it. Documented in a comment there;
      `src/test/render.test.tsx` still finds no `NaN` and no `undefined` on any screen.

### Bit-identical, and proven

- [ ] The pinned literals in `src/game/seats.test.ts` — the three named seeds' `deals`, `outcome`,
      `money`, `ante`, `blindIdx`, `runScore` and hands, and the fifty-seed aggregate — are
      **unchanged**, and the rotation test is unchanged. The only edit permitted in that file is the
      accessor `r.state.money` → `econOf(r.state, 0).money`; the PR body shows `git diff` on it
      touching no literal.
- [ ] `toShop` rolls stock into the owner's wallet only (`d.economies[ownerSeat(d)]`), so the number
      of `rng` draws per run is unchanged; the other three keep `shop: null`, `rerollCost` at its
      `createRun` value and `shopAfterBoss` false. `startDeal` resets `swapsLeft` and `usedSide` for
      all four wallets (no randomness). A test in `src/game/reducer.test.ts` plays a blind and its
      shop with `src/test/bot.ts` and asserts `economies[1..3]` are deep-equal to `newEconomy()`
      afterwards.
- [ ] `src/test/factories.ts` and `src/test/harness.tsx` port the reference's fixture split: a
      loose override's economy fields fold into seat 0's wallet, so `st({ jokers: [...] })`,
      `loadedState({ money: 20, jokerSlots: 3, shop: SHOP })` and the existing `scoring.test.ts` /
      `render.test.tsx` fixtures keep their present text. `wallets(n)` / `setEcon`-style helpers may
      be ported; nothing named `myEcon` may be.

### Persistence

- [ ] `SAVE_VERSION` in `src/game/save.ts` is `3`, with a comment saying why. `SavedEconomy` stores
      a wallet's `jokers` and `consumables` as content ids and its `shop` as `SavedShopItem[]`;
      `SavedRun`'s top level keeps only `boss` by id. `rehydrate` validates all four wallets and
      rejects the save **whole** on the first unknown joker, consumable, voucher or shop id, on a
      malformed side-deck card, or on an `economies` array that is not four long.
- [ ] `upgradeV1`, its two lines in `rehydrate` and its five cases in `src/game/save.test.ts` are
      **deleted**. A new `upgradeV2` folds a v2 payload's seventeen flat economy fields into
      `economies[0]`, leaves the other three at their `createRun` value, and **refuses rather than
      guesses**: a v2 payload missing `money`, `jokers`, `consumables` or `vouchers`, or carrying a
      non-number where a count belongs, is rejected exactly as it would be with no upgrade at all.
      It carries the same removal note `upgradeV1` did — delete the function, its call and its
      tests, and the version gate rejects v2 for free.
- [ ] `src/game/save.test.ts` covers: a fresh round trip in which a **non-owner** seat's wallet
      (money, a joker, a side-deck card) survives; a `v: 1` payload rejected; a `v: 2` payload
      upgraded, with `economies[0].money`, its jokers and its shop stock arriving intact and
      `economies[1]` at `newEconomy()`; a malformed wallet rejected.

### Documentation and gates

- [ ] `CLAUDE.md` is updated: a `game/economy.ts` row in the module table and its name in
      non-negotiable rule 1's list; a short section stating that the wallet is per seat, that every
      pure function takes the seat whose wallet it is, and that there is deliberately no
      viewer-resolving helper; the run-persistence known gap records version 3, `upgradeV1`'s
      deletion and `upgradeV2`'s removal note; the test count line matches what `npm test` reports.
- [ ] `README.md`'s save-version paragraph says the discard has now happened twice, and that a run
      saved under version 2 is carried across by a temporary upgrade rather than lost.
- [ ] `src/components/screens/Rules.tsx`, `src/i18n/fi.ts` and `src/i18n/en.ts` are **unchanged** —
      no rule of tuppi moves and no new player-facing string is needed. A diff that touches any of
      the three is a defect. `src/index.css` and `src/components/rail/Rail.tsx`'s markup are
      unchanged too, so the delivered phone measurements still hold.
- [ ] All five gates pass: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"The four seatless economy actions" names five.** `buy`, `reroll`, `sellJoker`, `sellSideCard`
  and `useConsumable` are five actions, and all five gain `p: Seat`. The run-flow actions that also
  move money — `startBlind`, `skipBlind`, `toShop`, `nextBlind`, `nextDeal` — do **not**: they are
  not a player's economy decision and have no seat to carry.
- **"scoreTrick is handed the SCORING side's inventory (the trick winner's)" is
  self-contradictory, and the parenthetical loses.** In nolo and in sooli the scoring side is
  precisely _not_ the trick winner — `scoresFor` returns true for the team that **dodged** the
  trick — so handing `scoreTrick` the winner's wallet would score an empty wallet on every dodged
  trick and move nearly every literal in `seats.test.ts`. The wallet passed is
  `econOf(g, ownerSeat(g))`, which is what `resolveTrick` already computes and passes as `owner`.
  The requirement's own harder constraint — bit-identical single player — is what settles it. **If
  the reviewer meant the winner's wallet literally, this is the line to change**, and the golden
  test has to be recaptured with it.
- **Which of a team's two seats owns the scoring wallet: `ownerSeat`, not the pair summed.** Both
  seats of a team could hold inventory once there is more than one human; summing or choosing
  between two live wallets is a design decision with a balance consequence and is out of scope, as
  it was in the seat-absolute spec.
- **"The other three economies are empty" is read as empty _inventories_.** All four seats get the
  same `newEconomy()` — including the starting `money: 6` and the standard slot, swap and
  `rerollCost` values — exactly as the reference implementation does, because a seat-dependent
  starting purse is a balance decision this change has no mandate for. What the criteria assert is
  that seats 1–3 hold no joker, no consumable, no voucher, no side-deck card and no shop stock, and
  that a whole blind and shop leaves them deep-equal to `newEconomy()`.
- **The golden test "passes unchanged" is read as "its literals are unchanged".** `r.state.money`
  no longer type-checks once the field moves, so the accessor must become
  `econOf(r.state, 0).money`. Any change to a pinned number would be a defect, and the PR shows the
  diff to prove none happened.
- **One shop is rolled, for the owner.** `shop` is per-seat now, but `toShop` rolls stock into the
  owner's wallet only. Rolling four would draw four times the randomness and move every golden
  literal in the run; a shop for an AI seat has no buyer.
- **`SAVE_VERSION` goes to 3, v1 support is deleted, and a new `upgradeV2` is written.** This is
  three decisions in one and the reviewer should see all three. CLAUDE.md forbids _chaining_ the
  temporary upgrade, so v1 is dropped outright — runs saved before the seat-absolute change are now
  gone for good, which is the loss that spec's migration only deferred. A v2 → v3 upgrade is added
  in its place because the mapping is mechanical and lossless (every field that moved exists in a v2
  payload holding exactly the value seat 0's wallet should hold) and because the alternative
  discards every run in flight for a pure refactor. Only one migration exists at a time, so no chain
  forms. **If the reviewer prefers the plain discard, delete `upgradeV2`, its call and its tests —
  nothing else in this spec depends on it.**
- **The chip number printed on a card follows the viewer, not the card's holder.**
  `PlayingCard` is a view, so it passes the viewing seat to `chipValue`; the printed number answers
  "what is this card worth to me". The pure `chipValue` still takes a seat, so nothing in the core
  learns who is looking, and in single player the viewer _is_ the owner, so no printed number moves.
- **`shopAfterBoss` is a property of the blind, not of a wallet.** It is moved into `PlayerEconomy`
  because the requirement lists it; only the owner's copy is ever written, and the other three stay
  false and inert.
- **`swapsLeft` and `usedSide` are reset for all four wallets at the start of a deal.** The reset
  consumes no randomness, and a per-deal ration that only one seat got back would be wrong the
  moment a second human sits down.
- **Run-level money stays the owner's.** The cash-out reward, interest, spare-deal and sooli bonus,
  the skip-blind $2 and the `bank` on the cash-out screen all credit `econOf(d, ownerSeat(d))`,
  because none of those transitions carries a seat.
- **Classified `rule`, though no rule of tuppi moves.** `rule` and `scoring` run the identical
  verification set — playtest, balance and mutation — so neither skips a gate; `infra` would skip
  all three, and this change rewrites the scoring path, most of the reducer's shop and consumable
  cases and the save format. The failure modes it can produce are a silently moved score, a lost
  wallet and a deal that never advances, which is exactly what those three stages catch. **The
  balance stage must measure no change; any movement in the measured figures is a defect here, not
  a result.**

## Touch points

The files and functions this is expected to change. All real.

- `src/game/types.ts` — `PlayerEconomy` (seventeen fields); `GameState.economies`; the seventeen
  top-level fields removed; `ScoreContext`'s `money` / `sideDeckEnh` re-sourced.
- `src/game/economy.ts` — **new.** `econOf(g, p)`, and nothing else.
- `src/game/state.ts` — `newEconomy()`; `createRun`'s literal loses the economy lines and gains
  four factory calls.
- `src/game/cards.ts` — `chipValue` takes the seat and reads `econOf(g, p).chipBonus`.
- `src/game/rules.ts` — `anySwapAvailable` reads the seat's `sideDeck` / `usedSide`; `ownerSeat` and
  `ownerTeam` unchanged.
- `src/game/scoring.ts` — `TuppiState` / `ScoreState` picks; `tuppiInfo`, `tuppiMult`, `finalScore`
  and `scoreTrick` take the seat whose wallet scores; the steel count still reads that seat's hand.
- `src/game/shop.ts` — `StockState` becomes the seat's wallet; `rollShopStock` reads its `jokers`,
  `vouchers` and `shopSlots`.
- `src/game/reducer.ts` — `startDeal`'s swap reset and swap-phase gate, `resolveTrick`'s payout and
  glass break, `cashOut`, `skipBlind`, `useConsumable`, `discardAt`'s callers, and the `toShop`,
  `buy`, `reroll`, `sellJoker`, `sellSideCard`, `useConsumable` and `pickSideCard` cases.
- `src/game/actions.ts` — the five actions that gain `p: Seat`.
- `src/game/save.ts` — `SAVE_VERSION` 3; `SavedEconomy`; `SavedRun`; `dehydrate`; `rehydrate`'s
  per-wallet validation; `upgradeV1` deleted; `upgradeV2` added.
- `src/components/rail/{Stats,JokerList,ConsumablesBox,SideDeckBox}.tsx` — read
  `econOf(g, useViewSeat())`; dispatch the seat.
- `src/components/screens/{Shop,ReplacePick,Victory}.tsx` — the same, plus `buy` / `reroll` payloads.
- `src/components/panels/SwapPanel.tsx` — `sideDeck`, `usedSide`, `swaps`, `swapsLeft` from the
  seat's wallet; the panel's own `useState` selection unchanged.
- `src/components/PlayingCard.tsx` — `chipValue(g, seat, card)`.
- `src/components/rail/Slate.tsx`, `src/components/screens/{DealEnd,GameOver,CashOut}.tsx` —
  `tuppiInfo` / `finalScore` gain the seat.
- `src/test/factories.ts` — `newEconomy`-shaped `emptyEcon`, `splitEcon`, `st`.
- `src/test/harness.tsx` — `loadedState` folds economy overrides into seat 0.
- `src/test/bot.ts` — `basicPolicy.swap` and `playToScreen`'s swap branch read the seat's wallet.
- `src/test/invariants.test.ts` — `PURE_CORE` gains `economy.ts`; the "no economy field on
  `GameState`" case; the `createRun` case extended to `PlayerEconomy`.
- `src/game/{reducer,scoring,rules,save,rng,seats}.test.ts`, `src/test/render.test.tsx` — updated
  for the new shapes; `seats.test.ts` accessor only.
- `CLAUDE.md`, `README.md` — the documentation criteria above.

## Out of scope

- **Any multiplayer.** No lobby, no transport, no lockstep loop, no peer, no action queue, no seat
  picker, no second human on the board. This is the wallet's owner only.
- **`localSeat`, `myEcon`, `seatKind`, `usTricks`/`themTricks`.** `main` replaced all four
  deliberately; none of them comes back, and the reference implementation's use of them is not
  ported.
- **Deciding whose inventory scores when both seats of a team own one.** `ownerSeat` answers it
  while one seat owns the shell; splitting or summing two live wallets is a later spec.
- **Rendering from a seat other than 0.** The viewing seat is still a constant `0`; `SEATS[0]` still
  carries `key: "seat.you"`, and nothing lets a player change seats.
- **Any balance change.** No price, no slot count, no reward, no starting purse and no reroll cost
  moves. The balance stage should measure exactly what it measured before.
- **A shop, a purchase or a spend for an AI seat.** The AI never buys, `toShop` rolls one shop, and
  no policy in `src/test/bot.ts` gains a purchase.
- **New player-facing text.** `fi.ts`, `en.ts` and `Rules.tsx` are untouched.
- **Migrating a v1 save**, which is deleted here, and any later v3 chain.
- **Layout.** No CSS and no rail markup change, so the delivered phone and short-window
  measurements stand without being re-measured.

## Source

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022).** Tuppi is four players
  in two partnerships; the sheet's rules concern the deal, the näyttö, rami/nolo, ryöstö, sooli,
  follow-suit and how a pair's tricks are counted into points. **It describes no economy at all** —
  no money, no purchases, no jokers, no side deck. Those are Balatro's roguelike shell layered on
  top, so who owns a wallet is not a tuppi rule and cannot contradict the source. Nothing in the
  sheet's rules of play is touched by this change, which is what the bit-identity criteria exist to
  prove.
- **<https://korttipeliopas.fi/tuppi>.** The same: four players, two pairs, the declaration and the
  trick play, and no economy. Confirms that the fields moving here belong to the shell and not to
  the game.
- **Chosen reading, to be written into a comment beside `econOf` in `src/game/economy.ts`:** the
  wallet is a property of a seat, and the seat is always a parameter — the pure core never asks
  which seat is looking, because under lockstep multiplayer every peer runs the same reducer over
  the same actions and a wallet resolved from the window would be the one value that differed.
