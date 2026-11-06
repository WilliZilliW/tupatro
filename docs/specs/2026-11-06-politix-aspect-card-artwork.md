---
id: 2026-11-06-politix-aspect-card-artwork
title: Draw Politix's table cards as illustrated card faces, with one look per aspect
kind: ui
status: proposed
---

# Draw Politix's table cards as illustrated card faces, with one look per aspect

## What

Today Politix's felt (`PolitixTable.tsx`) is text in boxes: each voter group is a bordered box
with a name, a count and the line "Argue 5 · Evade 3 · Charm 4 · Growl 6"; the event is a sentence
in the header; a politician's skills are a sentence; scandals and burnouts in front of a seat are a
sentence. After this, every card on the felt is drawn as a card face, the same paper-and-frame shape
the hand's action cards already have, with an original inline-SVG illustration on it. That covers
the voter-group cards, the event card, and the scandal and burnout cards lying in front of a seat.

Each of the four aspects (the code calls them tactics: `PxTactic` = `argue` `evade` `charm`
`growl`) gets one colour token, one icon and one card style. That look is used in the same way
everywhere the aspect appears: on a tactic card in the hand, on the per-aspect need chips of a voter
card, on a politician's skill chips, on the event card, and on the action bar while a tactic is
locked in. No rule, number, phase, action or saved field changes. No catalogue string is added: the
sentences the chips replace become the `aria-label` of the chip row.

## Acceptance criteria

- [ ] **Four aspect tokens, four distinct colours.** `src/index.css`'s `:root` declares
      `--px-argue`, `--px-evade`, `--px-charm` and `--px-growl`. The rules `.pxt-argue`,
      `.pxt-evade`, `.pxt-charm` and `.pxt-growl` each set `--px-aspect` to their own token, and
      every aspect-coloured surface reads `var(--px-aspect)`: the card band, the icon's
      `currentColor`, the chip, and the bar's accent. A new case in `src/test/invariants.test.ts`
      reuses the existing comment-stripped `index.css` parse (the `rules` array pattern near line 346) and asserts three things. The four tokens exist. Their four values are **four distinct
      strings**. Each `.pxt-<aspect>` rule's declarations reference `--px-<aspect>` and no other
      aspect's token. Proposed values are argue `#1F5FA8` (blue), evade `#17785A` (teal), charm
      `#C2366B` (rose) and growl `#A4501A` (rust). They must not equal the four `--suit-*` values,
      which the current `.pxt-*` colours partly copy. The test asserts that too.
- [ ] **A tactic card in the hand carries its aspect's look.** `PolitixCard` in
      `src/components/PolitixCard.tsx` puts `pxt-<tactic>` on the root of a tactic card. That class
      is already there today and is kept. The card draws a coloured band in `var(--px-aspect)`, the
      aspect's `PolitixIcon`, and the existing `px.tactic.*` label. A case in
      `src/test/render.test.tsx` renders one card of each tactic. It asserts four distinct `pxt-*`
      classes, exactly one `svg` per card, and that each card's text is that locale's
      `px.tactic.<tactic>` label. It runs in both locales.
- [ ] **Coffee is drawn as the wild card.** A `.pxk-coffee` card's background or band references
      all four `--px-*` aspect tokens, for example as a four-stripe gradient, so its wildness reads
      at a glance. The `invariants.test.ts` case above asserts that the `.pxk-coffee` declarations
      name all four tokens. Burnout, news and scandal keep a neutral, non-aspect style and carry
      no `pxt-*` class. The render case asserts the absence of the class.
- [ ] **Six voter-group illustrations.** `PxIconName` gains the six `PxGroup` ids (`farmers`
      `workers` `whitecollar` `youth` `blondes` `hippies`), and `PolitixIcon` draws an original
      inline SVG for each one. They use the same `common` props (`currentColor`, `viewBox 0 0 32 32`,
      `aria-hidden`) as the existing eleven icons. A render case renders `PolitixIcon` for every
      member of `PX_GROUPS` and `PX_TACTICS_LIST`. Each one must produce an `svg` with at least one
      child shape, and no two of the six group icons may have identical `innerHTML`.
- [ ] **Voter cards are card faces.** `PolitixBoard` draws one `.pxvcard` per distinct group
      present in `px.table`, in `PX_GROUPS` order. That is the order `onTable` already uses. Each
      `.pxvcard` carries:
  - the existing `pxg-<group>` class, whose colour becomes the card's band;
  - the group's `PolitixIcon`;
  - the group name `px.group.<group>`;
  - a count badge (`.pxcount`) with `fmt(n)` of that group's cards on the table, drawn as a stack
    (offset shadows) when `n > 1`;
  - a `.pxneeds` row of exactly four `.pxchip` elements in `PX_TACTICS_LIST` order. Each chip has
    class `pxt-<tactic>`, the aspect's icon, and the text `fmt(PX_GROUP_NEED[group][tactic])`.

  `.pxneeds` carries `role="img"` and `aria-label` set to the existing `px.needs` sentence, so the
  words are not lost. A render case on `politixState()` asserts all of this: the `.pxvcard` count
  equals the number of distinct groups on the table, each card's badge text, and each card's four
  chips' classes and numbers.

- [ ] **The event is a card.** When `px.event` is set, the header area draws a `.pxevcard`
      carrying `pxt-<event tactic>` (from `PX_EVENTS[].tactic`), that aspect's icon, `nameOf(ev)`
      and `descOf(ev)`. When it is `null`, the card's slot is drawn as an empty dashed outline
      (`.pxevcard.empty`) holding `px.eventNone`, so the layout does not move when the first event
      appears. A render case asserts both states, and for each of the four events that the class
      matches the event's tactic.
- [ ] **A politician's skills are chips.** Each `.pxseat` draws its politician as a card-framed
      area with the party symbol's icon, `nameOf(pol)`, and a `.pxskills` row of four `.pxchip`
      elements in `PX_TACTICS_LIST` order. Each chip has class `pxt-<tactic>` and the text `+` plus
      `fmt(skill)`. The row carries `role="img"` and `aria-label` set to the existing `px.skills`
      sentence. The existing render assertions keep passing unchanged: `.pxseat` ×3, `.pxparty` ×3
      and `.pxscandals` ×1 in "Politix: three parties on the felt…", and `.privstage .pxseat` ×3
      in the private view.
- [ ] **Scandals and burnouts in front of a seat are mini card faces.** The `.pxscandals`
      container draws one mini card per scandal, with the scandal icon and its
      `px.scandal {group}` label, and each one carries that group's `pxg-<group>` class. A burnt
      seat's `.pxburned` draws one mini burnout card. A render case asserts that a seat holding
      two scandals draws two mini cards.
- [ ] **The felt stays read-only.** No `<button>` and no `MoveButton` is rendered anywhere inside
      `.pxfelt`. The felt's cards are `div`/`span` elements, not `PolitixCard`'s `<button>`. Either
      factor the face out of `PolitixCard` as a non-interactive `PolitixCardFace`, or pass a prop
      that switches the root element. A render case asserts
      `container.querySelector(".pxfelt button") === null` on a table with an event, scandals and a
      burnout.
- [ ] **The action bar wears the locked aspect.** While at least one tactic card is selected,
      `.pxbar` carries `pxt-<lockedTactic>`, and `.pxpower` is preceded by that aspect's icon. With
      only coffee or only specials selected, `.pxbar` carries no `pxt-*` class. A render case on a
      human `pxturn` state clicks one tactic card and asserts the class and the icon. It then
      deselects the card and asserts that the class is gone. The `<select>` options stay text,
      because an `<option>` cannot hold an SVG.
- [ ] **No new player-facing text, both locales intact.** `src/i18n/fi.ts` and `src/i18n/en.ts`
      gain no key. Every label on the new faces is an existing key: `px.tactic.*`, `px.group.*`,
      `px.event.*.n/.t`, `px.scandal`, `px.burnout`, `px.coffee`, `px.news`, `px.eventNone`,
      `px.needs` and `px.skills`. Every number goes through `fmt()`. Any glyph drawn is SVG, not a
      new text character, so no tofu probe is needed. The render sweep (`render.test.tsx`, both
      locales) and the no-literal test pass unchanged.
- [ ] **Gates.** `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` pass. The look itself is subjective, so the reviewer should
      open a Politix game (single player, then Politix) and check five things:
  - At 1280x800, 1280x500, 390x844 and 844x390, the hand row and the action bar are fully on
    screen. The felt scrolls inside itself (`.pxfelt{overflow-y:auto}`) rather than pushing them
    off.
  - The four aspects can be told apart by colour alone, on the paper card faces and on the chips.
  - The event card's band matches the colour of that aspect's chips on the voter cards.
  - A selected argue card turns the bar blue.
  - Both languages fit on the faces without clipping. Finnish "Toimihenkilöt" and "Maanviljelijät"
    are the longest group names, so they are the ones to check.

## Assumptions

- **"Aspect" means `PxTactic`.** The requirement's four words (argue, evade, charm, growl) are
  exactly the four `PxTactic` members, so no new type is introduced. Code keeps the word "tactic".
  The spec says "aspect" only because the requirement does.
- **"Table cards" means four things:** the voter-group cards in `px.table`, the active event, and
  the scandal and burnout cards lying in front of a seat. The politician area gets a card frame
  and skill chips, but **no portrait**. A politician illustration would be character art and
  needs a decision of its own; see Out of scope.
- **Voter cards are drawn one face per group, with a count badge and a stack effect, not one face
  per voter card.** Taking is per group, which is why the current felt already groups the cards by
  group. Eight full-size faces would also not fit a 390-px-wide felt beside the seats. A reviewer
  who wanted eight separate cards should say so. The data is already there.
- **The needs and skills sentences move from visible text to `aria-label`.** Visibly, each aspect
  becomes its icon, its colour and a number. The word for each aspect is still printed on every
  tactic card in the hand, which is where a player learns the mapping. No legend or new string is
  added. If the reviewer finds the chips unreadable without words, the fix is a legend built from
  the existing `px.tactic.*` keys, not a new key.
- **The colour values are proposals; distinctness is the contract.** The four hex values above
  were picked by eye for contrast on both the paper face and the dark felt, not measured. The test
  pins only that they are distinct and differ from the suit tokens. The current `.pxt-*` colours
  reuse three suit hexes (`#17569C`, `#15683B`, `#C0392B`), and that pairing is dropped on
  purpose. The same colour meaning "diamond" in one mode and "argue" in another is not a
  relationship worth keeping.
- **All art is original inline SVG in `currentColor`.** This carries forward
  `2026-11-03-add-politix-card-game-mode` and `2026-11-04-rework-politix-three-parties`: no
  publisher art, no card text from the original game, and no real party logos or real people.
  The six group icons are generic objects. Proposals: a wheat sheaf (farmers), a wrench (workers),
  a briefcase (white-collar), headphones (youth), a hand mirror (blondes), a daisy (hippies). The
  implementer may substitute other generic objects, but no symbol belonging to a real organisation.
- **No animation is added.** Card faces get static styling only. That avoids a new
  `prefers-reduced-motion` obligation and keeps the existing `.pxcard.selected` lift unchanged.
- **`2026-11-04-politix-multiplayer-lobby` listed "New art or images" as out of scope.** That was
  a scope line for that spec, not a decision against art, so this spec does not reverse anything.
  `2026-09-25-improve-politics-card-look` is about **Politiikka** (the eighth mode, `PlayingCard`),
  not Politix, and is untouched.
- **The dead `.pxk-mod` selector** in `index.css` (the `mod` kind was removed by the rework) may be
  deleted while the line is being edited. Nothing reads it.

## Touch points

- `src/components/PolitixCard.tsx`:
  - `PxIconName` gains the six group ids, and `PolitixIcon` gains six `case`s.
  - `PolitixCard` gets an aspect band.
  - A non-interactive face, either `PolitixCardFace` or a prop on `PolitixCard`, for the felt's
    mini scandal and burnout cards.
  - A small `PxChip` (aspect icon + number) shared by the felt's needs and skills rows, and
    possibly the bar.
- `src/components/table/PolitixTable.tsx` (`PolitixBoard`):
  - `.pxgroup` boxes become `.pxvcard` faces with `.pxneeds` chips.
  - The header's `px.eventNow` sentence becomes a `.pxevcard`. The `px.eventNow` key may stay
    unused, or may be used as the card's `aria-label`.
  - `.pxseat` gets a framed politician with `.pxskills` chips.
  - `.pxscandals` and `.pxburned` get mini card faces.
- `src/components/hand/PolitixHand.tsx`: `.pxbar` gets `pxt-<lockedTactic>` and the aspect icon
  before `.pxpower`.
- `src/components/table/PrivateTable.tsx`: no change expected. It draws `PolitixBoard` and
  inherits everything.
- `src/index.css`, in the `---------- Politix ----------` section after the base rules it overrides
  (the source-order rule in CLAUDE.md):
  - the four `--px-*` tokens in `:root` and the `.pxt-*` rules rewritten to set `--px-aspect`;
  - new rules for `.pxvcard`, `.pxcount`, `.pxneeds`, `.pxskills`, `.pxchip`, `.pxevcard` and the
    mini faces;
  - `.pxk-coffee`'s four-stripe band;
  - the short-window block (`max-height:480px and max-width:920px`) extended for the new faces.
- `src/test/render.test.tsx`: the render cases named above. Both locales are covered where the
  case reads text.
- `src/test/invariants.test.ts`: the CSS token case.

## Out of scope

- Any Politix rule, number, phase, action, `PolitixState` field, `hashState` input or
  `NET_VERSION`. This is markup and CSS only, and `src/game/` is untouched.
- Politician portraits or any character art. That would be a separate spec, and it needs the same
  "original, nobody real" line the tuppi portraits drew.
- Highlighting, on the felt, the need chip that matches the tactic currently selected in the hand.
  The selection is component-local to `PolitixHand`, and sharing it with the felt needs a context
  this spec does not add.
- Marking a group's home tactic (`PX_GROUP_HOME`) on its voter card.
- Replacing the group and target `<select>`s with illustrated pickers.
- The rail's Politix plate, the `PolitixOver` result screen and its board. They keep their current
  look.
- Animation of any kind (deal-in, take, flip).
- The rules panel and README. No rule changed, so `Rules.tsx` and README's "The challenges:
  Politix" stay as they are.

## Source

Not a rule or scoring change. The four aspects, the six groups and the four events come from
`2026-11-04-rework-politix-three-parties`, whose own source citations stand. Nothing here reads or
alters them.
