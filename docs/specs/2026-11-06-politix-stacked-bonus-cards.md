---
id: 2026-11-06-politix-stacked-bonus-cards
title: Draw every Politix voter card on its own, and pile each seat's bonus cards beside it as full-size cards
kind: ui
status: proposed
---

# Draw every Politix voter card on its own, and pile each seat's bonus cards beside it as full-size cards

## What

Two changes to Politix's felt (`PolitixBoard` in `src/components/table/PolitixTable.tsx`).

**Every voter card on the table is drawn as its own card.** Two farmers on the table are two
farmer cards, not one farmer card with a "2" badge. Cards of the same group sit next to each
other. Each copy prints what it costs to win it: the first copy shows the group's need for each
tactic, and every further copy shows one more. That is the take rule the game already plays (the
first card needs the full need, and each extra card of the same group in the same play needs one
more point of power), now visible on the cards.

**Each seat's bonus cards are piled on the right-hand side of that seat's area, drawn as ordinary
cards.** These are the cards that change the seat's power: the party symbol (SUV / tractor / bus),
the politician (Orator, Smiler, …), a burnout if there is one, and every scandal. Each one is drawn
at the same size and in the same paper face as an action card in the hand. Today they are a text
line, a small framed panel and mini chips.

No rule, number, phase, action, saved field, hash input or catalogue string changes.

## Acceptance criteria

- [ ] **No game, network, hook or catalogue change.** `git diff origin/main -- src/game/ src/net/ src/hooks/ src/i18n/`
      is empty. `NET_VERSION`, `SAVE_VERSION`, `SCOPE`, `hashState` and `pxTakeCount` are untouched.
- [ ] **One `.pxvcard` per voter card.** `PolitixBoard` draws exactly `px.table.length`
      `.pxvcard` elements. Each one carries `data-uid` set to its `PxVoter.uid`, and the React key
      is that uid, never the group. Cards are grouped in a `.pxvgroup` wrapper per group present,
      carrying `data-group="<group>"`. The wrappers are in `PX_GROUPS` order. Inside a wrapper the
      cards are in `px.table` order. That is the order in which `pxDoPlay` in `reducer.ts` removes
      them, so the first card drawn is the first card won. `.pxcount` and `.pxvcard.stack` no
      longer exist: `container.querySelector(".pxcount")` and `container.querySelector(".pxvcard.stack")`
      are both `null`, and their rules are deleted from `src/index.css`.
- [ ] **Each copy prints its own cost.** The k-th card of a group (k = 0, 1, 2, … within its
      `.pxvgroup`) keeps the existing `pxg-<group>` class, the group icon, the group name and a
      `.pxneeds` row of four `.pxchip`s in `PX_TACTICS_LIST` order. Each chip has class
      `pxt-<tactic>` and the text `fmt(PX_GROUP_NEED[group][tactic] + k)`. The row's `aria-label`
      is the existing `px.needs` sentence with those same raised numbers. A render case sets the
      table by hand to eight cards with at least three of one group and two of another, for
      example `farmers, youth, farmers, hippies, farmers, youth, workers, blondes`. It asserts the
      count, the wrapper order, each card's `data-uid`, and every chip's number. It runs in both
      locales.
- [ ] **The printed cost agrees with the rule.** The same render case asserts, for every group on
      that table with `n` copies and every copy `k`, and for every tactic, that
      `pxTakeCount(chip, need, n) === k + 1`, where `chip` is the number read off the k-th card's
      chip for that tactic and `need` is `PX_GROUP_NEED[group][tactic]`. The test reads the number
      from the DOM, not from the formula, so a card that prints the base need on every copy fails.
- [ ] **One pile per seat, on the right.** Each `.pxseat` contains exactly one `.pxpile`. It is
      the last child of the `.pxseat`, and `.pxseat` lays out as a row (text on the left, the pile
      on the right). The text column holds the seat name, the party name (`px.party.<party>`) and
      the hand count (`px.hand`).
- [ ] **The pile's contents and order.** A seat's `.pxpile` holds exactly
      `2 + (burn ? 1 : 0) + scandals.length` faces, in this order:
  - the party symbol face, carrying `pxparty` and `pxg-<symbol group>`, with the symbol's icon,
    `px.symbol.<symbol>`, and the group's icon followed by `+` and `fmt(PX_SYMBOL_BONUS)`. Its
    `title` is the existing `px.partyInfo` sentence;
  - the burnout face (`pxk-burnout`) if the seat is burnt out;
  - one scandal face (`pxk-scandal pxg-<group>`) per entry of `px.scandals[s]`, in that order,
    each with the scandal icon and the existing `px.scandal {group}` label;
  - the politician face last, so it lies on top. It carries `pxpol` and holds `nameOf(pol)`, the
    party symbol's icon, and the existing `.pxskills` row: four `.pxchip`s in `PX_TACTICS_LIST`
    order reading `+` and `fmt(skill)`, with the existing `px.skills` `aria-label`.

  A render case on a seat with a burnout and two scandals asserts the count, the order (by class)
  and the politician face being last. It also asserts that a seat with neither has exactly two
  faces.

- [ ] **Bonus cards are normal cards.** Every direct child of `.pxpile` carries the `pxcard` class.
      That is the same class, and so the same size rule, as an action card in the hand: 72x98 by
      default and 60x80 in the short-window block. None of them is a `<button>`. The face markup is
      shared with the hand: `PolitixCard` in `src/components/PolitixCard.tsx` and a non-interactive
      `PolitixCardFace` (root `<span>`, no `onClick`, no `aria-pressed`) render the same band, icon
      and label. `PolitixMiniFace` and the `.pxmini` rules are deleted. A `.pxcard` that is not a
      button sets `cursor:default` and never gets the `.selected` lift. A render case asserts that
      every `.pxpile > *` has `pxcard`, that its tag is not `BUTTON`, and that
      `container.querySelector(".pxfelt button") === null`.
- [ ] **The pile overlaps.** In `src/index.css`'s Politix section, every pile face after the first
      has a negative inline-start margin, so the faces overlap like a pile. The politician face is
      the last and is fully visible. Each underlying face keeps its band and its icon inside the strip
      that stays uncovered. A case in `src/test/invariants.test.ts` reuses the comment-stripped
      `index.css` parse and asserts that a rule matching the pile's later faces (for example
      `.pxpile > * + *`) declares a negative `margin-left` or `margin-inline-start`.
- [ ] **Existing assertions are edited, not weakened.** In `src/test/render.test.tsx`:
  - "draws voter cards with a count badge and four need chips" is replaced by the per-copy case
    above;
  - in "draws skills as chips, scandals and burnouts as mini cards…", `.pxscandals .pxmini` ×2
    becomes `.pxpile .pxk-scandal` ×2, and `.pxburned .pxmini` ×1 becomes `.pxpile .pxk-burnout`
    ×1;
  - in "draws exactly three politician areas…", `.pxscandals` ×1 becomes `.pxpile .pxk-scandal`
    ×1.

  `.pxseat` ×3, `.pxparty` ×3, `.pxskills` ×3, `.privstage .pxseat` ×3 and every other Politix
  assertion keep passing unedited.

- [ ] **Text and numbers.** `src/i18n/fi.ts` and `src/i18n/en.ts` gain no key and lose none. Every
      number on a face goes through `fmt()`. The render sweep passes in both locales.
- [ ] **Gates.** `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` pass. The layout itself is checked by eye. A reviewer opens
      single player, then Politix, and checks the following:
  - At 1280x800, 1280x500, 390x844 and 844x390, the hand row and the action bar stay fully on
    screen, and the felt scrolls inside itself (`.pxfelt{overflow-y:auto}`).
  - Eight separate voter cards wrap without clipping, and copies of one group read as one run.
  - In every seat area, the pile sits to the right of the text. Each underlying card's colour band
    and icon are visible, and the politician's four skill chips are readable.
  - The Finnish labels "Maanviljelijät", "Toimihenkilöt" and "Skandaali: hipit" fit on a
    full-size face.

## Assumptions

- **This reverses an assumption of `2026-11-06-politix-aspect-card-artwork`, which is delivered
  (commit `510dc35`).** That spec drew "one face per group, with a count badge and a stack effect,
  not one face per voter card". It also said that "a reviewer who wanted eight separate cards
  should say so". The user has now said so, so this spec wins. The parts of that spec that this
  spec does not touch stand: the aspect tokens, the icons, the event card, the chips and the bar.
  Only its "Voter cards are card faces" criterion is changed, in its count badge and stack parts.
  Its "scandals and burnouts are mini card faces" criterion is also changed: they become
  full-size faces in the pile. That spec's file is not edited (one file per run).
- **The take rule is already what the requirement describes, so this is `ui`, not `rule`.**
  `pxTakeCount(power, need, onTable)` in `src/game/politix.ts` returns `min(onTable, 1 + power − need)`
  when `power ≥ need`. So the first card needs the full need and every further card of the same
  group needs one more. `politix.test.ts` already pins `pxTakeCount(5, 3, 4) === 3`, the sheet's
  p. 4 arithmetic. The requirement's third sentence is read as describing that rule, and the
  delivery is to make it visible on each copy. **If the user meant a different rule**, for
  example that each extra card costs a whole further need, this spec does not deliver it, and that
  needs a `rule` spec of its own.
- **"Requires +1" is printed as the raised need on each chip of the copy.** The second copy shows
  `need + 1` on all four tactics, the third `need + 2`, and so on. The alternative was to print the
  base need on every copy and add a "+1" marker to the later ones. That was rejected because it
  needs a new marker and a new string, while the raised number is just a number. Event, skill,
  scandal and symbol effects change **power**, not need, so none of them is folded into the
  printed numbers. This is the same reason today's chips show the plain need.
- **"Bonus cards" means four kinds of card:** the party symbol, the politician, a burnout and the
  scandals. These are everything lying in front of a politician that changes its power or its
  turn. The user's examples were "tractor/orator/smiler", which are a symbol and two politicians.
  Burnout and scandals are included because they lie in the same place. Leaving them as mini chips
  beside full-size cards would be two looks for one kind of thing.
- **"On the right-hand side" means the right of each seat's own area,** not one shared column on
  the right of the felt. A pile is about one politician, and the seats are already the felt's
  per-politician areas. If the user wanted every pile in one column at the felt's right edge,
  that is a layout change on top of this one.
- **"Pile up" means overlapping.** The faces overlap left to right, with the politician last and on
  top, because it carries the most to read (four skill chips). The overlap amount is not pinned,
  only its sign. The reviewer judges whether each underlying card is identifiable.
- **"As normal cards" means the hand card's class and size,** not a new size. That is why
  every pile face carries `pxcard`, and why `PolitixMiniFace` goes.
- **The party's name moves to the seat's text column.** The `px.partyInfo` sentence moves to the
  symbol face's `title`. The `.pxparty` class moves onto the symbol face, so the existing ×3
  assertion holds.
- **Copies of one group get a wrapper (`.pxvgroup`), not overlap.** A voter card's four chips are
  its whole content, so overlapping copies would hide the numbers that this spec adds.
- **The hand's group `<select>` still shows the base need for the locked tactic.** It names the
  group, not a copy. See Out of scope.

## Touch points

- `src/components/table/PolitixTable.tsx` (`PolitixBoard`):
  - the `onTable` group loop becomes a per-group `.pxvgroup` with one `.pxvcard` per `PxVoter`,
    keyed by uid, each with its copy index `k`;
  - `.pxseat` becomes a text column plus a `.pxpile`;
  - the `.pxparty` line, `.pxpol`, `.pxburned` and `.pxscandals` move into the pile as faces.
- `src/components/PolitixCard.tsx`:
  - `PolitixCardFace` (non-interactive, shared markup with `PolitixCard`);
  - a symbol face and a politician face, or props on `PolitixCardFace` that cover both;
  - `PolitixMiniFace` is deleted.
- `src/index.css`, `---------- Politix ----------` section, after the rules it overrides:
  - `.pxvgroup`, `.pxpile` and the overlap rule;
  - `.pxseat` as a row;
  - non-button `.pxcard` (`cursor:default`);
  - the `.pxpol` and `.pxskills` sizing inside a 72x98 face;
  - deleting `.pxcount`, `.pxvcard.stack` and `.pxmini*`;
  - the short-window block (`max-height:480px and max-width:920px`) extended for the pile.
- `src/test/render.test.tsx`: the per-copy voter case, the pile case and the three edited
  assertions above. The `PolitixCardFace` import replaces any `PolitixMiniFace` import.
- `src/test/invariants.test.ts`: the overlap-margin case.
- `src/components/table/PrivateTable.tsx`: no change expected. It draws `PolitixBoard`.

## Out of scope

- Any Politix rule or number. That includes `pxTakeCount`, the needs, the symbol bonus, the
  scandal delta, the AI and the measurement. See the second assumption for what to do if the take
  rule itself was meant to change.
- `Rules.tsx`, `README.md` and `CLAUDE.md`. No rule changed. The rules panel already says "every
  extra point of power wins one more card of the same group".
- Highlighting, on the felt, which copies the current selection in the hand would win. The
  selection is local to `PolitixHand`, and sharing it needs a context. The previous spec ruled
  this out too.
- Showing the raised need in the hand's group `<select>`, or a take preview on the action bar.
- One shared column of bonus cards at the felt's right edge (see the assumption above).
- Politician portraits or any character art.
- Animation of any kind: dealing in, taking, or a card moving into a pile.
- The rail's `PolitixPlate`, `PolitixOver` and the board.

## Source

Not a rule or scoring change. The take rule this spec makes visible is unchanged, and was checked
against the Politix rule sheet (Touko Tahkokallio / Onni Games 2009), p. 4. Power at least the
card's number for that tactic wins one card, and each extra card of the same group costs one more
power. `pxTakeCount`'s comment cites the same page, and
`2026-11-04-rework-politix-three-parties` lists it under its sources. Neither tuppi source (the
Oulunsalo senior tuppi club's rule sheet, Antti Auer, 9 September 2022, and
<https://korttipeliopas.fi/tuppi>) knows this game.
