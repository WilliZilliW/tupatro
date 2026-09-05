---
id: 2026-09-06-tuppipakka-swap-info-and-cancel
title: Select a tuppipakka card, read what it does, then swap or cancel
kind: ui
status: proposed
---

# Select a tuppipakka card, read what it does, then swap or cancel

## What

Today a click on a card in the tuppipakka is the whole swap: the card is spent, the hand card is
replaced and the only account of it is a toast that vanishes. The player never sees what the
enhancement does, which card in hand it is about to upgrade, or — for a dimmed card — why it
cannot be taken, and there is no way back from a misclick.

After this, a click on a side-deck card **selects** it. The swap panel then shows an infobox for
that card: its face, the enhancement's name and description, the hand card it would replace, and,
when the swap is not possible, the reason. Two buttons finish the interaction — confirm the swap,
or cancel the selection and pick another card.

**This reverses a documented decision.** CLAUDE.md ("The swap is one click.") and README.md ("A
swap is therefore a single click") both state one click as deliberate. See Assumptions; the
requirement wins, and both paragraphs are rewritten in the same pull request.

No rule moves. `swapTargets`, the same-card rule, `swapsLeft`, the `swap` phase and the
`pickSideCard` action are all untouched — only when that action is dispatched changes.

## Acceptance criteria

- [ ] **A click selects instead of swapping.** With `renderWith(loadedState({ phase: "swap" }),
    <Table />)`, `fireEvent.click` on the `.sidecard` whose `data-uid` is `sideDeck[0].uid`
      leaves `dispatch` with no call of type `pickSideCard`, and `#declpanel .swapinfo` is in the
      DOM. Every `.sidecard` carries `data-uid`, so the test can name one.
- [ ] **The infobox names the enhancement.** In both locales, with `sideDeck[0]` selected,
      `.swapinfo` `textContent` contains `nameOfIn(locale, ENH[sideDeck[0].enh])` and
      `descOfIn(locale, ENH[sideDeck[0].enh])`.
- [ ] **The infobox shows both cards of the exchange.** `.swapinfo` holds exactly two `.card`
      elements, with `data-uid` equal to the selected side card's `uid` and to
      `swapTargets(g, sel)[0].uid` — the hand card the swap would replace.
- [ ] **Confirm sends the existing action, once.** Clicking the confirm button in `#declpanel .row`
      calls `dispatch` exactly once, with `{ type: "pickSideCard", uid: sideDeck[0].uid }`, and
      `.swapinfo` leaves the DOM afterwards. No new action type is added to
      `src/game/actions.ts`.
- [ ] **Cancel dispatches nothing.** Clicking the cancel button removes `.swapinfo` from the DOM
      and leaves `dispatch` with zero calls for the whole select-then-cancel sequence. Clicking the
      already-selected `.sidecard` again does the same.
- [ ] **An unavailable card is inspectable but not confirmable**, in all three ways it can be
      unavailable. Selecting `sideDeck[1]` (twin dealt to another seat) renders `.swapinfo` with
      the confirm button `disabled` and `.swapwhy` `textContent` equal to
      `translate(locale, "swap.unavailNoMatch", { card: cardName(sideDeck[1]) })`; with
      `usedSide: [sideDeck[0].uid]` the reason is `swap.unavailUsed`; with `swapsLeft: 0` it is
      `swap.unavailNoSwaps`. In each case `dispatch` is never called.
- [ ] **The selection is not game state.** `src/game/types.ts`, `src/game/actions.ts`,
      `src/game/reducer.ts`, `src/game/schedule.ts` and `src/game/save.ts` are unchanged in the
      diff, and `game/save.test.ts` and `game/reducer.test.ts` pass with no edits.
- [ ] **Both catalogues carry the new keys.** `swap.selected`, `swap.replaces`,
      `swap.unavailUsed`, `swap.unavailNoMatch`, `swap.unavailNoSwaps` and `btn.doSwap` exist in
      `src/i18n/fi.ts` and `src/i18n/en.ts`; `swap.unavailNoMatch` carries `{card}` in both, and
      `i18n/i18n.test.ts` passes its placeholder-parity check.
- [ ] **The render sweep covers both new states.** `src/test/render.test.tsx` gains two `PANELS`
      fixtures — the swap panel with an available card selected and with an unavailable one
      selected — and both pass `check()` in `fi` and `en`: no `undefined`, no `[object Object]`,
      no leaked catalogue key, no Finnish word in the English output.
- [ ] **The phone panel-scroll law still holds with the infobox open.** The delivered criterion of
      `2026-09-03-playable-on-a-phone-screen` re-measured in headless Chrome at 390x844, 360x740
      and 844x390, in `swap` with a card selected and `#declpanel.scrollTop === 0`: every
      `#declpanel .row` button and every `.sidecard` has a rect inside the viewport and
      `document.elementFromPoint()` at its centre returns it or a descendant. jsdom cannot see
      this; the reading is the proof.
- [ ] **The documentation no longer says one click.** `README.md`'s "A swap is therefore a single
      click" paragraph and `CLAUDE.md`'s "**The swap is one click.**" passage describe select then
      confirm. `grep -n "single click\|one click" README.md CLAUDE.md` returns nothing about the
      tuppipakka swap.
- [ ] **Every gate passes**: `npm run lint`, `npm run typecheck`, the Prettier check over
      `**/*.{ts,tsx,json,md,html}`, `npm test` and `npm run build`. The test count in `CLAUDE.md`
      is updated from 444 to the new total.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **This reverses a decision the project wrote down twice.** CLAUDE.md says "**The swap is one
  click.** The twin is unique … so `swapTargets` returns at most one card and there is nothing for
  the player to choose", and README.md line 121 says the same. The requirement wins, on the reading
  that the reason given was "nothing to choose" — and an infobox gives something to _read_ before
  choosing, plus a way out of a misclick. The reviewer should decide whether that trade is wanted;
  if it is not, this whole spec is the thing to reject. Both paragraphs must be rewritten in the
  same PR, or the project documents the opposite of what it ships.
- **Classified `ui`, not `rule`.** Nothing in `game/` changes: the same-card rule, `swapTargets`,
  `canSwapIn`, `anySwapAvailable`, `swapsLeft`, the `swap` phase and the `pickSideCard` reducer
  case are all untouched. Only the moment the component dispatches moves. No rule source needed to
  be consulted, and none is cited.
- **The selection is component-local `useState` in `SwapPanel.tsx`, holding a `uid`** — not a field
  on `GameState`. Precedent: the rail's page index. Consequences, both intended: it is not in the
  save, so a resumed run never comes back with a pending selection; and it is cleared for free when
  the panel unmounts as the phase leaves `swap`. If the selected `uid` is no longer in `g.sideDeck`,
  the panel renders as though nothing were selected, so no effect is needed to reconcile it.
- **"Infobox about the card" is read as** the card's face, the enhancement's name and description
  from `ENH` (`enh.*.n` / `enh.*.t`, already in both catalogues), the hand card it would replace,
  and the reason when it cannot be swapped. Chip values are not spelled out in prose — `PlayingCard`
  already prints `+chips` on every face it draws.
- **Every side-deck card is selectable, the dimmed `used` and `nomatch` ones included**, because an
  explanation is worth most exactly where the card cannot be taken. Consequence: the panel stops
  sending a doomed `pickSideCard`, so `toast.swapNoMatch` and `toast.noSwapsLeft` are no longer
  reachable from the swap panel. Both keys and both reducer guards stay — the reducer is still the
  authority on the rule, and `reducer.test.ts` covers them.
- **The footer shows Swap and Cancel while a card is selected, and "To declaration" otherwise** —
  two buttons at a time, never three. `#declpanel .row` is a sticky footer measured at 360 px wide
  and a third button risks the delivered panel-scroll criterion. Cancel is the route back to "To
  declaration"; the player is never stuck.
- **Confirm clears the selection unconditionally** rather than waiting to observe `usedSide`. The
  button is only enabled when the swap is legal, and the reducer decides either way.
- **One selection at a time.** Clicking a second card moves the selection to it; clicking the
  selected card cancels.
- **The new keys are** `swap.selected`, `swap.replaces`, `swap.unavailUsed`, `swap.unavailNoMatch`,
  `swap.unavailNoSwaps` and `btn.doSwap`. `btn.cancel` already exists and is reused. The Finnish
  wording is the implementer's, constrained only by the i18n test and by `tuppipakka` staying
  Finnish in both languages.
- **`swap.pickSide` is reworded in both catalogues** to describe selecting a card and then
  confirming. `hint.swapPickSide` is left as it is: it describes the first step and is still true.
  The rules-panel item (`rules.list` in `fi.ts`) describes the same-card rule and says nothing about
  clicks, so the panel needs no change — but the implementer must check it rather than assume.
- **No accessibility work beyond real `<button>` elements** for confirm and cancel. The side cards
  stay focusable divs with no ARIA, per the documented gap; this spec does not close it.
- **No balance measurement is required.** The bot in `src/test/bot.ts` dispatches through
  `game/drive.ts`, not through the panel, so `basicPolicy.swap` is unaffected and the measured side
  deck figures in README.md do not move.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/components/panels/SwapPanel.tsx` — the whole change: a `useState<string | null>` for the
  selected `uid`, `data-uid` on each `.sidecard`, the `.swapinfo` block, the `.swapwhy` reason line,
  and the confirm / cancel pair in the `.row` footer.
- `src/components/PlayingCard.tsx` — reused as is; `data-uid` reaches the element through the
  existing `...rest` spread. The side card keeps `twin`, the hand card it replaces does not.
- `src/game/rules.ts` — `swapTargets` and `canSwapIn` are _read_ by the panel to find the twin and
  to gate the confirm button. Not changed.
- `src/game/cards.ts` / `src/game/content.ts` — `enhOf`, `cardName` and the `ENH` row are read for
  the infobox. Not changed.
- `src/i18n/fi.ts` — the six new keys plus the reworded `swap.pickSide`.
- `src/i18n/en.ts` — the same keys; it will not compile until it has them.
- `src/index.css` — `.swapinfo`, `.swapwhy` and `.sidecard.selected`. Hand-formatted and excluded
  from Prettier; keep it compact and class-based.
- `src/test/render.test.tsx` — two new `PANELS` fixtures, and a `describe` for the click sequence
  (select, confirm, cancel, unavailable) asserting on the `dispatch` spy.
- `src/test/harness.tsx` — no change expected: `loadedState`'s side deck already holds one card
  whose twin is in hand and one whose twin is not.
- `README.md` — the "single click" paragraph in "The side deck (_tuppipakka_)".
- `CLAUDE.md` — the "The swap is one click." passage, and the test count.
- Deliberately unchanged, and the diff should show it: `src/game/reducer.ts`, `src/game/actions.ts`,
  `src/game/types.ts`, `src/game/save.ts`, `src/game/schedule.ts`,
  `src/components/panels/Panels.tsx`, `src/components/hand/Hint.tsx`.

## Out of scope

- **Choosing which hand card is replaced.** The twin is unique; `swapTargets` returns at most one
  card and this spec does not give the player a second list to pick from.
- **Any change to the swap rule itself** — same suit and same rank, two swaps a deal, before the
  declaration, a card already swapped in is not a target.
- **Undo of a swap already confirmed.** Cancel undoes a _selection_, never a spent swap.
- **An infobox anywhere else.** The shop already draws its own description per offer; the hand, the
  felt and the rail get nothing new here.
- **ARIA roles or labels on the side cards**, and keyboard selection of a card. The accessibility
  gap in CLAUDE.md stands as written.
- **Moving the selection into `GameState` or the save**, and any `SAVE_VERSION` bump.
- **Rail and phone page layout.** The five-page strip is
  `2026-09-05-swipeable-rail-pages-on-phone`; this spec only re-checks that spec's inherited
  `#declpanel` criterion and changes nothing in `components/rail/`.
- **Balance measurement and the README figures.** Nothing in `game/` changes, so nothing moves.
