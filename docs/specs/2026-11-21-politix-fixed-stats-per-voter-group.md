---
id: 2026-11-21-politix-fixed-stats-per-voter-group
title: Print the same four need values on every Politix voter card of a group
kind: ui
status: proposed
---

# Print the same four need values on every Politix voter card of a group

## What

On Politix's felt, every voter card of one group (kansanryhmä) prints the same four numbers: the
group's own need for each tactic, `PX_GROUP_NEED[group]`. All Workers cards match each other, all
Farmers cards match each other, and so on. Different groups still print different rows. Today the
k-th copy of a group prints `need + k`, so three Hippies cards read 3/6/4/5, 4/7/5/6 and 5/8/6/7.
After this change all three read 3/6/4/5.

No rule, number, phase, action, saved field, hash input or catalogue string changes. Only the
numbers drawn on the cards change.

## Acceptance criteria

- [ ] **Every copy prints the group's base need.** In `PolitixBoard`
      (`src/components/table/PolitixTable.tsx`), each `.pxvcard` of group `gr` has a `.pxneeds` row
      of four `.pxchip`s in `PX_TACTICS_LIST` order. Each chip has class `pxt-<tactic>` and the text
      `fmt(PX_GROUP_NEED[gr][tactic])`, with no `+ k` or any other per-copy offset. The row's
      `aria-label` is `t("px.needs", { a, e, c, g })` built from the same four base values.
      `grep -n "+ k" src/components/table/PolitixTable.tsx` finds nothing, and the `.map` over a
      group's cards no longer takes a copy index.
- [ ] **Copies of one group are identical.** A render case in `src/test/render.test.tsx`, in both
      locales, sets `px.table` by hand to the existing eight-card table
      (`farmers, youth, farmers, hippies, farmers, youth, workers, blondes`). For every `.pxvgroup`
      it asserts:
  - every card's four chip texts equal `PX_GROUP_NEED[gr][tactic]` for that tactic;
  - every card in the wrapper has the same chip texts as the first card;
  - every card in the wrapper has the same `.pxneeds` `aria-label` as the first card.

  It also adds a three-Hippies case, such as `hippies, hippies, hippies, farmers, …`, which is the
  user's own example. It asserts that all three Hippies cards read `3`, `6`, `4`, `5`.

- [ ] **Different groups print different rows.** The same render case asserts that the chip-text
      rows of the distinct groups on the table are pairwise different. `src/game/politix.test.ts`'s
      "the data obeys its stated constraints" block gains one assertion: the six
      `PX_TACTICS.map((t) => PX_GROUP_NEED[gr][t])` tuples, one per group in `PX_GROUPS`, are
      pairwise distinct. A future data edit that gives two groups the same row then fails a test.
- [ ] **The replaced assertion is replaced, not just deleted.** The case "draws one voter card per
      copy, each with its own cost" is renamed, for example to "draws one voter card per copy, every
      copy of a group alike". Its `expect(printed).toBe(need + k)` and
      `expect(pxTakeCount(printed, need, own.length)).toBe(k + 1)` lines become the identical-copy
      assertions above. Every other assertion in the case stays: no `.pxcount`, no
      `.pxvcard.stack`, eight `.pxvcard`s, wrapper order equal to `PX_GROUPS` order filtered to
      groups present, `data-uid` order equal to `px.table` order within a wrapper, the `pxg-<group>`
      class, four chips, and the `pxt-<tactic>` classes. If `pxTakeCount` has no other use in
      `render.test.tsx`, its import is removed so lint passes.
- [ ] **The take rule is untouched.** `git diff origin/main -- src/game/` changes only
      `src/game/politix.test.ts`, and only by adding the assertion above. `pxTakeCount`,
      `PX_GROUP_NEED`, `pxResolve`, the AI, `NET_VERSION`, `SAVE_VERSION`, `SCOPE` and `hashState`
      are unchanged. The existing `pxTakeCount` cases in `politix.test.ts` (`(5, 3, 4) → 3` and the
      rest) pass unedited. `git diff origin/main -- src/net/ src/hooks/` is empty.
- [ ] **No text change.** `src/i18n/fi.ts` and `src/i18n/en.ts` gain no key and lose none. The
      rules panel strings (`px.r…`) are unchanged, because the rule they describe is unchanged.
      `README.md` and `CLAUDE.md` are unchanged.
- [ ] **Gates.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` pass. The
      render sweep passes in both locales.
- [ ] **Browser check, by eye.** A reviewer opens Single player, then Politix. Wherever two or more
      cards of one group lie on the table, they show identical chips. Cards of different groups
      show different chips.

## Assumptions

- **This reverses a delivered criterion of `2026-11-06-politix-stacked-bonus-cards`** (commit
  `ba56022`, status still `proposed` in its front matter). That spec's "Each copy prints its own
  cost" criterion printed `need + k` on the k-th copy. Its "The printed cost agrees with the rule"
  criterion tested `pxTakeCount(chip, need, n) === k + 1` and says "a card that prints the base need
  on every copy fails". That spec also listed this alternative and rejected it. The user has now
  asked for exactly the base need on every copy, so **this spec wins** for those two criteria. The
  rest of that spec stands: one `.pxvcard` per voter card, the `.pxvgroup` wrappers, their order and
  the seat piles. That spec's file is not edited (one file per run). The assumption in
  `2026-11-20-politix-felt-fits-every-pile` that "voter copies were split apart … because each copy
  has a different cost" is no longer the reason. The copies stay split, because one card per voter
  card was also asked for in its own right.
- **This is `ui`, not `rule`. The take rule does not change.** `pxTakeCount(power, need, onTable)`
  stays `min(onTable, 1 + power − need)` when `power ≥ need`. Power at least the need wins one card,
  and each further point of power wins one more card of the same group. That is the Politix rule
  sheet's p. 4 arithmetic (Tahkokallio / Onni Games 2009), and it is not this pipeline's to change
  without a source. The requirement asks what the cards **show** ("must show the same four stat
  values", "show different numbers on the table"). It does not ask how many cards a power wins.
  **If the user meant the rule to change too**, for example that every card of a group costs its
  full need so two cards need twice the need, this spec does not deliver that. That reading
  contradicts the sheet's p. 4 and would need a `rule` spec, a rules-panel and README update, an AI
  check and a balance measurement of its own.
- **The escalation is still explained in words, but no longer printed on the felt.** The rules
  panel (`px.r…` in both catalogues) and README already say "every extra point of power wins one
  more card of the same group". No new hint, badge or "+1" marker is added. A player who reads only
  the cards may now expect a second Hippies card to cost 3 again. That is the cost of the
  requirement, and it is recorded here rather than fixed with an invented marker.
- **"Each group has its own values" is already true of the data, and is now pinned.** The six rows
  of `PX_GROUP_NEED` in `src/game/content.ts` are already pairwise distinct (farmers 5/3/4/6,
  workers 5/6/4/3, white-collar 3/4/6/5, youth 5/4/6/3, blondes 6/5/3/4, hippies 3/6/4/5). No number
  moves. The new `politix.test.ts` assertion only stops a future edit from making two groups alike.
- **"The four stat values" are the four tactic needs** (argue, evade, charm, growl), which are the
  four chips on a voter card. Event, skill, scandal and symbol effects change a seat's **power**,
  not a card's need. So they are not folded into the printed numbers. That is the same reason the
  chips never showed them.
- **The image attached to the requirement could not be inspected.** The reading rests on the
  requirement's own example. The three Hippies triples, 3/6/4/5, 4/7/5/6 and 5/8/6/7, are exactly
  `PX_GROUP_NEED.hippies` plus 0, 1 and 2, which is today's `+ k` in `PolitixTable.tsx`.
- **The hand's group `<select>` needs no change.** `PolitixHand.tsx` already prints the base
  `PX_GROUP_NEED[gr][lockedTactic]`, so the felt and the hand now agree.

## Touch points

- `src/components/table/PolitixTable.tsx` (`PolitixBoard`): in the `onTable` voter-card loop, drop
  the copy index `k` from the `.map`. Print `fmt(PX_GROUP_NEED[gr][tc])` on each `PxChip`, and build
  the `px.needs` `aria-label` from the four base values.
- `src/test/render.test.tsx`: rewrite the case "draws one voter card per copy, each with its own
  cost" as described above, add the three-Hippies table and the distinct-rows assertion, and remove
  the `pxTakeCount` import if it becomes unused.
- `src/game/politix.test.ts`: one assertion in "the data obeys its stated constraints", that the
  six groups' need tuples are pairwise distinct.
- No CSS change is expected. `.pxvgroup` and `.pxvcard` keep their markup and classes.

## Out of scope

- Any change to the take rule (`pxTakeCount`), the needs in `PX_GROUP_NEED`, the AI (`pxMove`), the
  balance or the measurement. See the second assumption.
- Any new on-card or felt marker for the escalating cost of extra copies ("+1", "second card", a
  take preview). It would need new catalogue strings and is a separate request.
- Merging copies of a group back into one card with a count badge. That was reversed by
  `2026-11-06-politix-stacked-bonus-cards` and this spec keeps one card per voter card.
- `Rules.tsx`, `README.md`, `CLAUDE.md` and both catalogues.
- The seat piles, the party symbols, the event card, the rail's `PolitixPlate`, `PolitixOver` and
  the board.
