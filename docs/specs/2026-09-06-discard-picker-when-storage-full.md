---
id: 2026-09-06-discard-picker-when-storage-full
title: Buy into a full slot by picking what it replaces
kind: ui
status: proposed
---

# Buy into a full slot by picking what it replaces

## What

Today a purchase that does not fit is simply refused: the buy button is enabled, the click reaches
the reducer, and a toast says the joker slots, the tuppipakka or the trick slots are full. The
toast and `shop.orderNote` both tell the player to sell something from the left rail first — which
is impossible from the shop, because `.overlay` is `position:fixed; inset:0` and covers the rail's
sell buttons. The offer is unbuyable for the rest of that shop.

After this, an offer that does not fit is bought by choosing what it replaces. The buy button reads
"Replace $n" instead of "Buy $n", and clicking it swaps the shelf for a picker listing everything
currently in that storage — each row with its name and its full description, so the choice is made
by reading what the held item does, not by remembering it. Selecting a row and confirming buys the
offer and discards the selected item; cancelling returns to the shelf and dispatches nothing.

No tuppi rule, no score and no price moves. The discarded item pays nothing back.

## Acceptance criteria

- [ ] **An offer that does not fit is labelled Replace and opens the picker instead of buying.**
      Render `<Shop />` over `loadedState` with a joker offer on the shelf, `jokers.length` equal to
      `jokerSlots` and enough money, in both locales: the offer's `.buy` button is enabled, its
      `textContent` equals `translate(locale, "shop.buyReplace", { price })`, and `fireEvent.click`
      on it leaves `dispatch` with zero calls and puts `.replacepick` in the DOM with `.shelf`
      gone. With `money: 0` the same button is `disabled` and no click opens anything.
- [ ] **The picker lists exactly that storage, with each item's description.** For the joker offer,
      `.replacepick .replaceitem` has `g.jokers.length` elements and the i-th contains
      `nameOfIn(locale, g.jokers[i])` and `descOfIn(locale, g.jokers[i])` in its `textContent`. For
      a consumable offer with `consumables.length === consSlots`, the same against `g.consumables`.
      For a card offer with `sideDeck.length === sideSlots`, `.replaceitem` count equals
      `g.sideDeck.length`, the i-th holds a `.card` whose `data-uid` is `g.sideDeck[i].uid`, and its
      `textContent` contains `nameOfIn(locale, ENH[g.sideDeck[i].enh])` and the matching
      `descOfIn`.
- [ ] **Select, then confirm — one dispatch, and cancel dispatches nothing.** The confirm button is
      `disabled` with nothing selected. Clicking `.replaceitem` at index `k` adds `selected` to its
      class list and dispatches nothing; clicking confirm then calls `dispatch` exactly once with
      `{ type: "buy", index: <the offer's shelf index>, replace: k }` and removes `.replacepick`
      from the DOM. In a separate select-then-cancel sequence `dispatch` has zero calls and `.shelf`
      is back in the DOM.
- [ ] **The reducer completes the purchase, keeps the storage at its cap and refunds nothing.** In
      `game/reducer.test.ts`, from a shop state with `jokers.length === jokerSlots`,
      `gameReducer(g, { type: "buy", index: i, replace: 0 })` gives
      `after.jokers.length === g.jokerSlots`, `after.jokers` containing the bought joker and not
      `g.jokers[0]`, `after.money === g.money - item.price`, `after.shop[i].sold === true` and
      `after.toast` empty. One equivalent case for `card` against `sideDeck` and one for
      `consumable` against `consumables`.
- [ ] **A bad or needless `replace` cannot corrupt an inventory.** Three reducer cases: with the
      storage full and `replace` out of range (`-1`, and `jokers.length`) the state is unchanged
      except for the existing full toast and `shop[i].sold` stays `false`; with room in the storage
      and `replace: 0` given, the purchase goes through and the joker count rises by one, i.e.
      nothing is discarded.
- [ ] **The three full-slot toasts stay the rule's authority and stay covered.**
      `toast.jokerSlotsFull`, `toast.sideDeckFull` and `toast.trickSlotsFull` remain in both
      catalogues, their reducer guards remain, and `game/reducer.test.ts` asserts each is raised by
      a `buy` with no `replace` against the matching full storage — the shop UI no longer reaches
      them, exactly as the swap panel no longer reaches `toast.swapNoMatch`.
- [ ] **A voucher never opens the picker.** Vouchers are uncapped, so with every storage full a
      voucher offer's `.buy` reads `translate(locale, "shop.buy", { price })` and one click
      dispatches `{ type: "buy", index }` with no `replace` field.
- [ ] **Nothing new lives in the state or the save.** The diff leaves `GameState` in
      `src/game/types.ts`, `src/game/save.ts`, `SAVE_VERSION`, `src/game/schedule.ts` and
      `src/game/storage.ts` unchanged — `src/game/actions.ts` gains only `replace?: number` on the
      existing `buy` action — and `game/save.test.ts` and `hooks/GameContext.test.tsx` pass with no
      edits. The pending offer and the selected index are `useState` in `Shop.tsx` and
      `ReplacePick.tsx`.
- [ ] **Both catalogues carry the new keys, and the shop stops giving advice that cannot be
      followed.** `shop.buyReplace`, `shop.replaceTitle`, `shop.replaceLead`, `shop.replaceFine`
      and `btn.doReplace` exist in `src/i18n/fi.ts` and `src/i18n/en.ts` with matching placeholder
      sets, and `i18n/i18n.test.ts` passes. `shop.orderNote` no longer tells the player to sell
      from the left-hand list: `grep -n "vasemman reunan\|left-hand list\|left rail" src/i18n/*.ts`
      returns nothing for that key.
- [ ] **The render sweep draws the picker in both languages.** `src/test/render.test.tsx` gains
      three fixtures — the shop with the picker open over a full joker list, a full tuppipakka and
      full trick slots — and each passes the suite's `check()` in `fi` and `en`: no `undefined`, no
      `[object Object]`, no `NaN`, no leaked catalogue key, no Finnish stopword in English output.
- [ ] **The picker is reachable on a short window and a phone.** Measured in headless Chrome at
      1280x500, 390x844 and 360x740, with the picker open over a full joker list and the `.overlay`
      at `scrollTop === 0`: `.replacepick` and its first `.replaceitem` have rects inside the
      viewport without scrolling, and every `.replaceitem` and every `.replacepick .row button` is
      hit-testable — `document.elementFromPoint()` at its centre returns it or a descendant, after
      scrolling the panel to it if needed. The shop's own `.row` still holds its `ScoresButton`
      while the picker is open, so `2026-09-04-view-the-scoreboard-any-time` still holds. jsdom
      lays nothing out; the reading is the proof.
- [ ] **Every gate passes**: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build`. The test
      total is updated in `CLAUDE.md` (currently 471) and in `README.md` (currently 444 in two
      places, already stale) to the new total.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Storage" is read as the three capped inventories**: jokers (`jokerSlots`), the tuppipakka
  (`sideSlots`) and the tricks/consumables (`consSlots`). Vouchers have no cap and are permanent, so
  a voucher offer keeps today's behaviour. The player's 13-card hand and the 52-card deck are not
  storage and are untouched.
- **The replaced item is destroyed and pays nothing back.** The requirement says "discard", so the
  purchase is not routed through `jokerSellValue` / `cardSellValue`. Two reasons beyond the wording:
  consumables have no sell value anywhere in the codebase, so a refund would either be inconsistent
  across the three lists or invent a number, and inventing an economy number is a balance change
  this spec is not classified for. **Consequence: replacing costs the new item's full price plus
  everything the old item was worth.** If the intent was sell-and-replace at half price, this is the
  line to reject.
- **This only adds an option, which is why it is `ui` and not `balance`.** Today a full storage
  refuses the purchase outright, so no existing path gets worse and no threshold moves. No headless
  measurement is required, and README's measured figures cannot move: `src/test/bot.ts` has no shop
  policy and never dispatches `buy`.
- **Select then confirm, not a click that discards.** This mirrors the pattern delivered yesterday
  in `2026-09-06-tuppipakka-swap-info-and-cancel`. A discard is irreversible and unrefunded, so a
  single misclick must not be able to destroy a joker.
- **The picker replaces the shelf inside the shop's existing `Overlay`** rather than opening a
  second overlay or a `g.modal`. `g.modal` is for views the player opens (rules, seed, restart,
  scores); this one belongs to a purchase in flight. The shop's heading, money line and footer row
  stay drawn, so `Next blind`, `Reroll` and `Scores` remain clickable — leaving the shop with a
  picker open simply abandons it.
- **The pending offer and the selection are component-local `useState`**, never `GameState`.
  Intended consequences: a reload or a phase change loses a pending pick, and nothing enters the
  save, so `SAVE_VERSION` is not bumped. Precedent: the swap panel's selection and the rail's page
  index.
- **`replace` is an index into the matching inventory array, not a `uid`.** Jokers and consumables
  carry no `uid`, and `sellJoker` / `sellSideCard` are already index-based. The index is read
  against the same array the reducer splices, and nothing reorders those arrays between dispatch and
  reduce.
- **`replace` is consulted only when the storage is actually full.** With room, the item is bought
  and nothing is discarded — the picker never opens in that case, so this is a defensive reading,
  and it goes into a code comment in the `buy` case rather than being left implicit.
- **The buy button is relabelled rather than left as Buy**, so the player learns the trade before
  clicking rather than after. `shop.buyReplace` carries `{price}` in both catalogues.
- **"Descriptions what those cards do" is read as** `nameOf` + `descOf` for a joker (with its
  existing mode tag) and for a consumable, and for a side-deck card the `PlayingCard` face with
  `twin` plus the enhancement's name and description from `ENH`. A side-deck card with no
  enhancement is not reachable today — every `cardOffer` carries one — but the row falls back to
  `cardName(c)` rather than rendering `undefined`, because a render path must be total.
- **The Finnish wording of every new string is the implementer's**, constrained by
  `i18n/i18n.test.ts` and by _tuppipakka_ staying Finnish in both languages. `shop.orderNote` is
  reworded in both catalogues because its "sell from the left-hand list" sentence describes
  something the overlay makes impossible; the joker-order half of that string stays.
- **No accessibility work.** The picker rows are the same focusable-div-and-button mix the rest of
  the game uses, with no ARIA roles and no keyboard selection. The documented gap stands.
- **No delivered spec contradicts this one.** Nothing in `docs/specs/` covers the shop's full-slot
  behaviour. The overlap is with `2026-09-06-tuppipakka-swap-info-and-cancel`, whose Out of scope
  says "an infobox anywhere else … the shop already draws its own description per offer": that line
  is about the _shelf_, which this spec leaves alone. The picker is a new view and deliberately
  re-opens that ground for the held items only.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/game/actions.ts` — the existing `{ type: "buy"; index: number }` gains `replace?: number`.
- `src/game/reducer.ts` — the `buy` case: each of the three full-storage guards gains a branch that
  splices `action.replace` out of `d.jokers` / `d.sideDeck` / `d.consumables` before the purchase
  proceeds, and toasts as today when `replace` is absent or out of range. Money is deducted after
  the discard and by the same amount as an ordinary purchase.
- `src/components/screens/Shop.tsx` — a `useState<number | null>` for the offer being replaced into,
  the `shop.buyReplace` label on an offer that does not fit, and rendering `ReplacePick` in place of
  `.shelf`.
- `src/components/screens/ReplacePick.tsx` — new. Props: the pending `ShopItem`, a confirm callback
  taking the chosen index, and a cancel callback. Holds the selected index in its own `useState` and
  draws `.replacepick`, the `.replaceitem` rows and the confirm / cancel `.row`.
- `src/components/PlayingCard.tsx` — reused unchanged for the tuppipakka rows; `data-uid` reaches
  the element through the existing rest spread, and `twin` prints the card it upgrades.
- `src/game/cards.ts` (`enhOf`, `cardName`) and `src/game/content.ts` (`ENH`) — read for the card
  rows, not changed.
- `src/i18n/fi.ts` — `shop.buyReplace`, `shop.replaceTitle`, `shop.replaceLead`,
  `shop.replaceFine`, `btn.doReplace`, and the reworded `shop.orderNote`.
- `src/i18n/en.ts` — the same keys; it does not compile until it has them.
- `src/index.css` — `.replacepick`, `.replaceitem`, `.replaceitem.selected` and the row layout.
  Hand-formatted, excluded from Prettier, class-based.
- `src/game/reducer.test.ts` — the replace cases, the out-of-range cases, the room-available case
  and the three full-slot toasts.
- `src/test/render.test.tsx` — three picker fixtures for the sweep, plus a `describe` for the click
  sequence (open, select, confirm, cancel) asserting on the `dispatch` spy.
- `src/test/harness.tsx` — no change expected: `loadedState` already fills the trick slots (2/2) and
  a test overrides `jokerSlots` / `sideSlots` for the other two.
- `CLAUDE.md` and `README.md` — the test totals, and one sentence in README's shop description if it
  claims a full slot blocks a purchase.
- Deliberately unchanged, and the diff should show it: `src/game/types.ts`, `src/game/save.ts`,
  `src/game/schedule.ts`, `src/game/shop.ts`, `src/game/rules.ts`, `src/game/scoring.ts`,
  `src/game/storage.ts`, `src/test/bot.ts`, `src/components/rail/*`.

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- **Selling for money from inside the shop.** No sell button, no refund, no half price — the
  discarded item is destroyed. The rail's `sellJoker` / `sellSideCard` buttons keep working exactly
  where they already do, during play.
- **Making the rail reachable from behind an overlay.** The `.overlay` law stands; this spec works
  around it for one interaction only.
- **Any change to slot counts, prices, sell values, or the vouchers that grant slots**
  (`kahvipannu`, `muistikirja`, `isompipakka`, `hihalaukku`), and any rebalancing measurement.
- **Undo of a completed replacement**, and any confirmation dialog beyond the picker's own confirm
  button. Cancel undoes a selection, never a purchase.
- **Using a consumable or swapping a tuppipakka card from the shop.**
- **Discarding outside a purchase** — there is no free "throw a joker away" button anywhere.
- **Joker ordering.** The scoring order stays automatic and locked; a replacement inherits no
  position and changes no order.
- **ARIA roles, labels or keyboard selection** in the picker, and the shelf's own layout, per-offer
  description and rarity line.
- **Any new `GameState` field, phase, screen kind or `SAVE_VERSION` bump.**
