---
id: 2026-11-20-politix-felt-fits-every-pile
title: Fit every Politix pile on the felt beside the voter cards, at every window size, and redraw the felt's pieces
kind: ui
status: proposed
---

# Fit every Politix pile on the felt beside the voter cards, at every window size, and redraw the felt's pieces

## What

The requirement (Finnish, paraphrased): _plan better graphics for Politix, and make sure the cards
played in front of the players fit on the table together with the voter-group cards._

Today they do not. Measured in Chromium on the current `main` (`PolitixBoard` in
`src/components/table/PolitixTable.tsx`, the `---------- Politix ----------` section of
`src/index.css`), with the worst legal pile: four scandals on one opposing seat, a burnout on every
seat and a 15-card hand. The felt overflows at 1280x500, 1000x700, 800x600, 844x390, 390x844 and
360x640. At 1000x700 the voter cards are crushed to 20–25 px wide. At 844x390 they are 14 px wide,
labels are clipped and the page itself scrolls. On both phones whole seat areas lie below the fold.
A freshly dealt game (no specials at all) already overflows at 1280x500, 800x600, 844x390 and both
phones. The causes are these:

- the seat column is as wide as its widest pile (`.pxseats{flex:none}` beside
  `.pxpile{flex-wrap:wrap; max-width:72%}`);
- every size is a fixed pixel value;
- the `@media (max-width:560px)` block moves the seats below the voters without regard to height.

After this spec the Politix felt is a size container. It scales one font-size knob to its own box
and picks one of two layouts by its own aspect ratio, so the worst legal pile, all eight voter
cards, the event, the party plates and every seat area fit inside it with no scrolling. This holds
at seven viewports, for 2, 3 and 4 players, in both languages. The felt's pieces are also redrawn
as original illustrated faces: the hemicycle felt, the news-banner event, the pile stacks, the
voter cards, the party plates, seat avatars with a last-play badge, and the scandal, burnout and
politician faces. No rule, state field, action, hash input, save or network version changes.

## Acceptance criteria

### Fit: the measured proof (`scripts/politix-fit.cjs`)

- [ ] **A new script, `scripts/politix-fit.cjs`**, started from a copy of the planning run's
      `measure.cjs` (scratchpad of this session). It is CommonJS and run as
      `node scripts/politix-fit.cjs [baseUrl]` against a running `npm run dev`. It requires the
      globally installed `playwright`, resolved through `NODE_PATH`, and adds **no dependency** to
      `package.json`. It is not run by `npm test` or CI. Its header comment says all three things,
      and says that it is the layout proof jsdom cannot give.
- [ ] **It fails loudly when its fixture did not apply.**
  - It builds the worst case by rewriting `src/game/politix.ts` as Vite serves it, wrapping
    `pxSetup`. If the fetched module text does not contain the marker `export function pxSetup(`,
    the script prints a message naming that marker and the file and exits non-zero. It never
    measures an unpatched game as if it were the worst case.
  - In worst mode it also checks, before measuring, that the patch took effect in the DOM: the foe
    seat's scandal faces' `data-count` values sum to 4, and every `.pxseat`'s pile holds a
    `.pxk-burnout` face. If not, it exits non-zero.
- [ ] **The matrix.** 7 viewports (1280x800, 1280x500, 1000x700, 800x600, 844x390, 390x844,
      360x640) x 3 player counts (2, 3, 4) x 2 locales (fi, en) x 2 states. That is 84 cases. The
      states are:
  - `worst`: the foe seat holds the four scandals `hippies, hippies, blondes, youth`, every playing
    seat holds a burnout, the owner's hand reaches 15 cards, `event: "doping"`, the turn is the
    owner's, and `last = { p: foe, what: "take", group: "whitecollar", n: 3 }`, as in `measure.cjs`;
  - `fresh`: an unmodified game start.

  It waits at least 300 ms after `.pxfelt .pxseat` appears before measuring.

- [ ] **Per case, all of these hold**, and the script exits non-zero and prints the failing case
      and check if any one does not:
  1. `.pxfelt`: `scrollHeight <= clientHeight + 1` and `scrollWidth <= clientWidth + 1`.
  2. Every `.pxvcard`, `.pxseat`, `.pxparty`, `.pxevcard` and `.pxpile > *` inside the felt lies
     within the felt's content rect (0.5 px tolerance).
  3. No two elements of the set {every `.pxvcard`, every `.pxseat`, every `.pxsymbols > .pxparty`,
     the `.pxevcard`} overlap by more than 1 px in both axes.
  4. In every `.pxpile`:
     - no fan face overlaps the politician face (`.pxpol`);
     - in the `stack` layout, consecutive fan faces' left edges differ by at least 1 em (the face's
       computed `font-size`);
     - in the `side` layout, no two fan faces overlap.

     The layout is read from the computed custom property `--px-layout` on `.pxmain` (below).

  5. No `.pxcard` inside `.pxfelt` has `scrollHeight > clientHeight + 1` or
     `scrollWidth > clientWidth + 1`.
  6. The computed `font-size` of `.pxmain` is at least **9 px**. If a case reaches only 8.6–9 px,
     it passes only if this spec's Assumptions name that viewport (none is named today).
  7. `.pxbar` and `.pxhandrow` lie fully inside the viewport.
  8. `document.documentElement.scrollHeight <= innerHeight` and `scrollWidth <= innerWidth`.

  The pull request body carries the script's summary line for all 84 cases, and the minimum
  `.pxmain` font-size observed per viewport.

### The design, as named code

- [ ] **One size knob, sized by the felt's own box.**
  - `.pxfelt` declares `container:pxfelt / size`.
  - `--pxf` is `clamp(8px, min(100cqw / var(--px-w), 100cqh / var(--px-h)), 14px)`.
  - `--px-w` and `--px-h` are unitless design sizes in em, set per layout and depending on
    `--px-seats`.
  - `.pxmain` and `.pxseats` take `font-size:var(--pxf)`. **`.pxfelt` itself never does**: an
    element cannot query its own container, so `cq` units and `@container` rules only reach
    `.pxfelt`'s descendants. `.pxfelt`'s own rule therefore has to serve both layouts. For example,
    it can be a wrapping flex row whose children choose their `order` and `flex-basis` inside each
    `@container` block.
  - Every Politix felt length after that is in `em`, apart from 1 px borders and hairlines.
- [ ] **Two layouts, chosen by the container's aspect ratio.**
  - **`side`**, under `@container pxfelt (min-aspect-ratio: 2/1)`: `.pxmain` is 24 em wide, with the
    voter cards. `.pxseats` is a column of N rows, each 4.8 em tall, and each row reads
    head | specials fan | politician. The fan faces never overlap in this layout.
  - **`stack`**, otherwise: `.pxseats` is a row of N tiles above the voter cards, laid out by
    `grid-template-columns:repeat(var(--px-seats), minmax(0,1fr))` (no `auto-fit`). The party
    plates are a column to the right of the voter cards.
  - Each block sets `--px-layout: side` or `--px-layout: stack` on `.pxmain` for the script to read.
  - `PolitixBoard` writes `--px-seats` inline on `.pxfelt`'s `style` from `seats.length`.
- [ ] **The DOM structure is kept.**
  - `.pxfelt`'s element children are exactly `.pxmain` then `.pxseats`, with those exact class
    names.
  - `.pxmain`'s element children are exactly `.pxhead`, `.pxgroups`, `.pxscore`, `.pxlast`,
    `.pxsymbols`, with those exact class names.
  - `.pxhead` is `display:contents`, and its own children are named in selectors (`.pxhead > *`),
    the same way `.railpage > *` is.
  - `.pxscore` keeps its element and its class name. It is hidden from sight only by a rule whose
    selector is `.pxmain > .pxscore`, using the clip pattern `.pxsr` uses, so a screen reader still
    reads the sentence form. Its visible content moves to the party plates.
  - `PolitixBoard` sets `lang={locale}` on `.pxfelt`.
- [ ] **The pile is a grid with a fan in its first cell.**
  - `.pxpile` is `display:grid`. Its element children are exactly the fan faces, then the
    politician face. There is no wrapper element and no badge as a direct child, so
    `.pxpile > *` stays "a face", which existing tests rely on.
  - Every fan face is placed in grid cell (1,1) and the politician in its own cell.
  - Fan face `i` (0-based, as `--i` inline) has
    `margin-left:calc(var(--i) * max(0px, min(3.5em, (100% - var(--cw)) / max(var(--k) - 1, 1))))`,
    where `--k` is set inline on `.pxpile` to the number of fan faces and `--cw` is the fan face
    width. The last face therefore never leaves its cell, and no margin is ever negative.
  - Each fan face carries its identifying icon inside its own left 1 em, so the strip a later face
    leaves uncovered (at least 1 em, criterion 4 above) always shows what the face is.
- [ ] **Identical scandals are one face.**
  - A new pure helper `pxPileFaces(burn: PxCard | null, scandals: PxCard[])` in
    `src/components/table/pxPile.ts` (no React, no `t()`, no literal player-facing text) returns
    `{ kind: "burnout" | "scandal"; group: PxGroup | null; count: number; uid: string }[]`.
  - The burnout comes first. Then come the scandals, grouped by `group` in first-seen order. `uid`
    is the first card's uid, and the input is not mutated.
  - `PolitixBoard` draws one fan face per entry. Each face is keyed by `uid` and carries
    `data-count={count}`.
  - A face whose `count >= 2` holds a `.pxmult` badge whose text is the new key `px.count`
    (`"×{n}"`, with `n` through `fmt`). No element anywhere carries the class `pxcount`, which an
    existing test pins as gone.
- [ ] **Felt cards are scoped and cannot spill.**
  - Felt cards are styled under `.pxfelt .pxcard`, with fixed em sizes and `overflow:hidden`. Their
    text is a single line with an ellipsis, or a 2-line clamp.
  - The hand's `.pxcard` rules (72x98, and 60x80 in the short block) no longer size a felt card.
  - No rule whose selector names a `.px` class declares `overflow-wrap:anywhere`.
  - `src/i18n/fi.ts` gains soft hyphens (U+00AD, written `\u00AD`) in `px.burnout`, `px.group.farmers`,
    `px.group.whitecollar` and every `px.pol.*.n` holding a single word longer than 10
    letters (today `Kaikenosaaja` and `Sovittelija`), so Finnish breaks at a syllable.
  - Text below a readable size is hidden visually through `.pxsr` inside an `@container` block and
    never removed. Its meaning stays on the icon, an `aria-label` or a `title`.
- [ ] **The Politix hand compacts on a short window.** The rule
      `@media (max-height:660px){.pxhandrow{height:90px} .pxhandrow .pxcard{width:60px;height:80px;font-size:9px}}`
      is added after the existing `(max-height:480px) and (max-width:920px)` Politix block. That
      block loses its felt lines (`.pxgroups`, `.pxvcard`, `.pxevcard`) and keeps its hand lines.
- [ ] **The phone block goes.** The `@media (max-width:560px)` Politix block (`.pxfelt`, `.pxmain`,
      `.pxgroups`, `.pxseats`) is deleted. No `@media (max-width:560px)` block contains a selector
      beginning `.px`.
- [ ] **Source order.** These are appended at the end of `src/index.css`, in this order, after
      every Politix rule they override:
  1. the `@container pxfelt` blocks;
  2. the 660 px hand block;
  3. one `@media (prefers-reduced-motion:reduce)` block that turns off `pxdeal` and the turn pulse.

  `src/index.css` stays in `.prettierignore`.

### Graphics (original art only)

- [ ] **Every new shape is original inline SVG** in `currentColor` and sized in `em`. There are no
      real party logos, no photographs and no likeness of any real person, and no new text glyph
      except `×` (see the tofu criterion).
- [ ] **`PolitixIcon` gains `cardback`, `rest`, `pass` and `politician`.** Each draws an `svg` with
      at least one child shape, and the 15 previous icons are unchanged. A render case asserts the
      four new ones are present and pairwise distinct by `innerHTML`.
- [ ] **The pieces.** Each of the following is present in the named file. A reviewer judges the
      look; see the browser checklist.
  - **The felt.** A hemicycle pattern drawn by `.pxfelt::before`. `.felt::after` is untouched.
  - **The header.**
    - A turn banner (`px.turnOf`).
    - `.pxlast` on one line with an ellipsis and `title={lastText}`.
    - The event as a news banner: a stripe, an aspect medallion icon, `nameOf(ev)`, and `descOf(ev)`
      clamped to 2 lines. `.pxevcard` and `.pxevcard.empty` keep their classes.
  - **The piles.** The `px.piles` sentence is drawn as three mini stacks (draw, discard, voter
    deck), using the `cardback` icon and `fmt(n)`. Their wrapper (`.pxstacks`) has `role="img"` and
    `aria-label` equal to the existing `px.piles` string.
  - **Voter cards.** A group-colour header, an icon medallion, the name clamped to 2 lines, the
    existing 2x2 `.pxneeds` chips, and `title` equal to `t("px.group.<g>")`.
  - **Party plates** (`.pxsymbols > .pxparty`, keeping `data-party` and the `px.partyInfo`
    `title`). Each has:
    - a larger vehicle icon, the party name, and a `+fmt(PX_SYMBOL_BONUS)` chip;
    - six `.pxtally` cells in `PX_GROUPS` order, each holding that group's icon and
      `fmt(px.collected[party][i])`.
  - **Seat areas** (`.pxseat`, gaining `data-seat={s}`):
    - an avatar disc (`.pxavatar`) with the party's vehicle icon and a ring in the symbol group's
      colour;
    - the seat name on a single line;
    - a hand-count chip (`.pxhandn`, the `px.hand` string);
    - a gold ring on `.pxseat.turn`;
    - a 2 s pulse on the turn seat, declared only inside
      `@media (prefers-reduced-motion:no-preference)`.
  - **The last-play badge** (`.pxlastbadge`), on the avatar of `px.last.p` only, with `title` and
    `aria-label` equal to `lastText`. By `px.last.what`:
    - `take`: the group icon plus `px.count` with `fmt(n)`;
    - `play`: the scandal icon;
    - `rest`: the `rest` icon (a crescent);
    - `pass`: the `pass` icon (a skip arrow).

    There is no badge when `px.last` is null.

  - **Fan faces and the politician.**
    - The scandal face is newsprint with a warning seal.
    - The burnout face is an ember gradient with the flame.
    - The politician face is a silhouette (the `politician` icon) in the symbol group's colour, with
      the name and the existing 2x2 `.pxskills` chips.
  - **Animation.** `@keyframes pxdeal` (220 ms) plays when a fan face mounts. It animates only
    `transform` and `opacity`, so it cannot move the layout. Since faces are keyed by `uid`, it
    plays once per new face.
- [ ] **Tofu.** `×` is probed against U+E000 by the canvas method in `CLAUDE.md`, and the result is
      written in the pull request. It already ships in `px.last.take`, so this is a confirmation.

### Tests

- [ ] **`pxPileFaces` unit test** (`src/components/table/pxPile.test.ts`):
  - `(null, [])` gives `[]`.
  - A burnout alone gives one face with count 1.
  - The worst pile `(burn, [hippies, hippies, blondes, youth])` gives kinds and groups
    `burnout, hippies, blondes, youth` with counts `1, 2, 1, 1`.
  - `[youth, hippies, youth]` gives `youth ×2, hippies ×1` (first-seen order).
  - A grouped face's `uid` is the first card's.
  - The input arrays are unchanged after the call.
- [ ] **A worst-case fixture in the sweep.** `src/test/render.test.tsx` gains `politixWorst(players)`.
  - It starts a game through the reducer with `startChallenge` `{ id: "politix", players }`, then
    sets the measurement's worst state:
    - the first playing seat whose party differs from the owner's gets the four scandals;
    - every playing seat gets a burnout;
    - `event: "doping"`;
    - `last = { p: foe, what: "take", group: "whitecollar", n: 3 }`.
  - `VIEWS` gains three rows, "the Politix felt and hand, worst case, N players" for N = 2, 3, 4,
    each rendering `<Table />` and `<Hand />`. The sweep then fails them on `undefined`, `NaN`, a
    leaked key or Finnish in English.
- [ ] **`describe("Politix: worst-case felt")`**, `it.each` over fi/en x 2/3/4 players, on
      `<PolitixBoard />` with `politixWorst(n)`:
  - exactly 8 `.pxvcard`;
  - exactly N `.pxseat`;
  - `.pxsymbols > .pxparty` count and `data-party` order equal to `pxPartiesInPlay(px)`, and each
    plate's six `.pxtally` texts equal `fmt(collected[party][i])`;
  - the foe's `.pxpile` children by class read `pxk-burnout, pxk-scandal (hippies), pxk-scandal
(blondes), pxk-scandal (youth), pxpol`, with the politician last. Their `data-count` values
    are `1, 2, 1, 1` (the scandal counts sum to 4), and the hippies face holds a `.pxmult` reading
    `translate(loc, "px.count", { n: "2" })`;
  - each fan face's `aria-label` equals its catalogue label (`px.burnout`, or `px.scandal` with
    that group's name);
  - `.pxstacks`' `aria-label` equals `px.piles` with the three `fmt` counts;
  - exactly one `.pxlastbadge` in the felt, inside the `.pxseat` whose `data-seat` is `px.last.p`,
    with `title` and `aria-label` equal to `px.last.take` as worded for this window;
  - `--px-seats` on `.pxfelt`'s inline style equals N;
  - each `.pxpile`'s inline `--k` equals its number of fan faces, and each fan face's `--i` equals
    its index;
  - `.pxfelt` carries `lang` equal to the locale;
  - `container.querySelector(".pxfelt button") === null`.
- [ ] **Existing Politix render tests pass unedited**: every case in
      `describe("Politix: three parties on the felt and in the target picker")`,
      `describe("Politix: aspect artwork")`, "Politix in a networked match" (including
      `.privstage .pxseat` x3), and the Politix `VIEWS` rows.
- [ ] **`src/test/invariants.test.ts`.** Two cases are replaced and named in the pull request; the
      rest pass unedited.
  - **Unedited:** "declares no negative inline-start margin on a rule naming .pxpile", "pins the
    symbols row to the bottom of the left column" (`.pxsymbols` keeps `margin-top:auto` in its
    base rule), "lays the voter cards in a grid of PX_TABLE / 2 columns", "stacks the seats in one
    column" (the `side` block's `.pxseats` declares `flex-direction:column`, and nothing uses
    `auto-fit`), and the aspect-token cases.
  - **"wraps the pile" is replaced by "fans the pile inside its own cell".** A rule naming
    `.pxpile` declares `display:grid`. A rule naming a pile face declares a `margin-left` that
    contains `var(--i)`, `max(0px` and `min(3.5em`.
  - **"falls back to one column on a phone, after the base .pxfelt rule" is replaced by "chooses
    the layout by the felt's own shape".** It asserts all of these:
    - `.pxfelt` declares `container:pxfelt/size` (whitespace stripped);
    - `index.css` contains `@container pxfelt (min-aspect-ratio:2/1)` (whitespace-normalised);
    - every `@container pxfelt` block starts after the base `.pxfelt{` rule;
    - no `@media (max-width:560px)` block contains a selector starting `.px`;
    - no rule naming a `.px` class declares `overflow-wrap:anywhere`.

  The `describe` title "Politix's bonus-card pile does not overlap" becomes "Politix's bonus-card
  pile fans without leaving its cell".

- [ ] **Text.** `px.count` (`"×{n}"`) is added to `fi.ts` and `en.ts` with the same placeholder.
      `fi.ts` gains the soft hyphens above. No other key is added or removed.
- [ ] **Gates.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` pass.
      `node scripts/politix-fit.cjs` passes all 84 cases against `npm run dev`.

### Docs and the browser

- [ ] **`CLAUDE.md`**, under "UI rules learned the hard way", directly after the media-query
      source-order paragraph, gains one paragraph saying three things:
  - an `@container` block loses to a later rule of equal specificity exactly as an `@media` block
    does, so the Politix container blocks sit at the end of the file;
  - an element cannot query its own container, so `.pxfelt`'s own rule serves both layouts and only
    its descendants switch;
  - jsdom lays out nothing, so `scripts/politix-fit.cjs` against `npm run dev` is the felt's layout
    proof.
- [ ] **`README.md`.** In "The challenges: Politix", the sentence "The felt keeps the voter cards in
      two rows of four on the left and the three seat areas in one column down its right edge
      (under the voter cards on a phone)." is replaced by one sentence. It says the felt scales to
      its own box and lays the seats beside the voter cards on a wide felt and above them otherwise,
      so every seat's pile fits.
- [ ] **The pull request's "Look at this in the browser" includes this item, which nothing above
      measures.** The shared-table private view: a window holding a chair while a display is
      connected, so `PolitixBoard` draws inside `.privstage`. `.privstage:has(> .pxfelt)` is
      `overflow-y:auto`, and size containment needs `.pxfelt` to have a definite height there.
      Check that the felt neither collapses to zero height nor overflows. Do this in both locales,
      at a 500 px tall window and at phone width, with the console open for errors. The list also
      includes:
  - the two layouts at 1280x800 (stack) and 1280x500 (side);
  - the fan at 360x640 with the worst pile;
  - the turn pulse with reduced motion on and off;
  - `pxdeal` when a scandal lands;
  - whether the felt's art reads as original and nobody's logo.

## Assumptions

- **"Plan better graphics" is read as "design and build them".** A plan was made and approved
  before this spec, and this spec delivers it. No separate planning document is committed.
- **`kind: ui`.** No rule, number, phase, action, `PolitixState` field, `hashState` input,
  `NET_VERSION` or `SAVE_VERSION` changes. The one catalogue key added and the soft hyphens are text
  that serves the layout.
- **The worst legal pile is 1 politician + 1 burnout + 4 scandals (3 distinct groups).** This is
  derived from the code, not assumed:
  - `pxResolve` refuses a burnout aimed at a seat whose `burn` is already set (`badBurnout`,
    `src/game/politix.ts`), so a seat holds at most one burnout;
  - `PX_SCANDAL_GROUPS` is `["hippies", "hippies", "blondes", "youth"]`, so the deck holds four
    scandals.

  A deck change that adds scandals or burnout slots invalidates the fit proof, and the script would
  need a new worst case.

- **User decision: partial overlap in the `stack` layout is accepted.** This deliberately reverses
  `2026-11-06-politix-show-played-cards-parties`'s "every card in front of a seat … is drawn whole,
  with no overlap" (and its "wrapping and never overlapping" eye check) in the `stack` layout. The
  `side` layout keeps no-overlap. In `stack`, each fan face keeps at least a 1 em strip showing its
  identifying icon, and identical scandals collapse into one face with a `×n` badge.
- **User decision: identical scandals are one face.** This contradicts
  `2026-11-06-politix-show-played-cards-parties`'s "A seat's `.pxpile` holds exactly
  `1 + (burn ? 1 : 0) + scandals.length` faces". It also contradicts
  `2026-11-06-politix-stacked-bonus-cards`'s "one scandal face per entry of `px.scandals[s]`". With
  two identical scandals the face count is now one less. Every existing test uses distinct scandal
  groups, so none breaks; the new worst-case test pins the grouped count. Two identical scandals
  are identical in effect (each is `PX_SCANDAL_DELTA` toward the same group), so a count loses
  nothing. Voter copies were split apart by `stacked-bonus-cards` for the opposite reason: each copy
  has a different cost.
- **User decision: the party symbols leave the bottom-left in the `stack` layout.**
  `2026-11-06-politix-show-played-cards-parties` put them "side by side at the bottom of the left
  column". In `stack` they become a column right of the voter cards. In `side` they stay under the
  voter cards. The `.pxsymbols` element, its place as `.pxmain`'s last child and its
  `margin-top:auto` base rule stay.
- **User decision: `.pxscore`'s visible text moves to the plates.** The element, its class and its
  two-party/three-party sentences stay in the DOM, so
  `show-played-cards-parties`'s "name two parties wherever a score is listed" still holds for a
  screen reader. It is hidden with the visually-hidden clip pattern rather than `display:none`.
  That choice is this spec's: the plan said only "hidden", and a clip keeps the sentences audible.
- **User decision: the phone media block is removed.** This reverses
  `2026-11-06-politix-side-piles-refill-deck`'s "under the voter cards on a phone" and its
  invariants case. That spec's "seats stacked one under another in a single column on the right"
  now holds only in the `side` layout. In `stack` the seats are a row above the voters.
- **User decision: about 9.4 px is the smallest card text at 844x390 and 360x640, and that is
  accepted.** The hard floor in the script is 9 px for `.pxmain`. Nothing below 9 px is accepted
  without a named viewport here, and none is named.
- **User decision: the last play is shown twice.** It stays a text line under the turn banner and
  also becomes a badge on the acting seat's avatar.
- **User decision: the Politix hand shrinks at window height ≤ 660 px.** Today it shrinks only
  under the `(max-height:480px) and (max-width:920px)` block. Other modes' hands are untouched.
- **User decision: the actual cards played are not shown.** There is no `PxLast.cards`, no state
  change, no `NET_VERSION` bump and no `SAVE_VERSION` change. The badge is built from the existing
  `PxLast` fields only.
- **`2026-11-06-politix-stacked-bonus-cards`'s "Bonus cards are normal cards … the same size rule
  as an action card in the hand: 72x98" is reversed.** Felt faces get their own em sizes under
  `.pxfelt .pxcard`. They keep the `pxcard` class, the paper face and the non-button root, which is
  what that spec's tests assert.
- **`2026-11-06-politix-aspect-card-artwork` is extended, not reversed.** Its "no catalogue string
  is added", "no animation" and "no politician portraits" lines were scope lines for that spec. This
  spec adds `px.count`, `pxdeal`, the turn pulse and a generic politician silhouette. The
  silhouette is a shape, not character art of anybody, and carries the same "original, nobody real"
  line.
- **The scroll is removed, not just moved.** The `aspect-card-artwork` and `stacked-bonus-cards`
  eye checks accepted "the felt scrolls inside itself (`.pxfelt{overflow-y:auto}`)". This spec's
  criterion 1 forbids a scroll in all 84 cases. `overflow-y:auto` may stay as a safety net, but
  must never be needed.
- **`lang` is set on `.pxfelt` only.** `index.html`'s `<html lang="fi">` is static whatever the
  locale, which is a project-wide gap. Fixing it is outside this felt.
- **`--k` counts fan faces only, without the politician.** The politician has its own grid cell,
  and the plan's "face count" is read that way.
- **A scandal added to an existing group bumps the badge without replaying `pxdeal`.** Faces are
  keyed by their first card's uid, so only a new face animates.
- **Soft hyphens travel into `aria-label`s and `title`s.** The catalogue string is used as is.
  Screen readers and Chrome's tooltip ignore U+00AD. This is not stripped.
- **Risk accepted: container query units** need Chrome 105+, Safari 16+ or Firefox 110+. On an
  older browser `--pxf` is invalid at computed-value time, and the felt falls back to the inherited
  font size and the default layout. This is not polyfilled.
- **Risk accepted: the fit harness is brittle by construction.** It rewrites
  `src/game/politix.ts` as Vite's dev server serves it, so it depends on the text
  `export function pxSetup(` and does not work against `npm run preview`. It fails loudly when the
  marker is missing, rather than measuring the wrong game.
- **Risk noted: `Keskusta` is also the name of a real Finnish party.** `px.party.centre` has said so
  since `2026-11-04-rework-politix-three-parties`. This spec adds no logo, emblem or colour scheme of
  any real party: the vehicle icons and the plates are generic.
- **Risk noted: the shared-table private view is unmeasured.** That is why it is a mandatory
  browser item rather than a script case. A size container inside `.privstage` with no definite
  height would collapse to 0 px, and jsdom would not notice.

## Touch points

- `src/components/table/PolitixTable.tsx` (`PolitixBoard`):
  - `lang` and `--px-seats` on `.pxfelt`;
  - the header pieces, `.pxstacks`, and the voter card markup;
  - plates with `.pxtally`;
  - seat areas with `data-seat`, `.pxavatar`, `.pxhandn` and `.pxlastbadge`;
  - the pile drawn from `pxPileFaces` with `--k` and `--i`.
- `src/components/table/pxPile.ts` (new) and `src/components/table/pxPile.test.ts` (new).
- `src/components/PolitixCard.tsx`: `PxIconName` and `PolitixIcon` gain `cardback`, `rest`, `pass`
  and `politician`. `PolitixCardFace` gains `aria-label`, `data-count` and the `.pxmult` badge, and
  draws the scandal and burnout art. The politician face gets the silhouette.
- `src/index.css`:
  - the Politix section: `.pxfelt` container and `::before`, em sizes, `.pxfelt .pxcard`, the
    `.pxpile` grid, `.pxsr`, `.pxmain > .pxscore`, `overflow-wrap:anywhere` removed;
  - the felt lines removed from the 480 px block, and the 560 px Politix block deleted;
  - appended at the end: the `@container` blocks, the 660 px hand block, the reduced-motion block.
- `src/i18n/fi.ts`, `src/i18n/en.ts`: `px.count`. `fi.ts` also gets the soft hyphens.
- `src/test/render.test.tsx`: `politixWorst`, three `VIEWS` rows, the new `describe`.
- `src/test/invariants.test.ts`: the two replaced cases and the renamed `describe`.
- `scripts/politix-fit.cjs` (new).
- `CLAUDE.md` (one paragraph) and `README.md` (one sentence).
- `src/components/table/PrivateTable.tsx`: no change expected. It is checked in the browser.

## Out of scope

- Showing which cards were played (`PxLast.cards`), and any `PolitixState`, `GameState`, action,
  `SCOPE`, `hashState`, `NET_VERSION`, `SAVE_VERSION` or `POLITIX_SCORES_VERSION` change.
- Any Politix rule, number, the AI, the deck composition or the measurement.
- The Politix hand's own markup and action bar, beyond the 660 px size block.
- `PolitixPlate` on the rail, `PolitixOver` and the board.
- `index.html`'s `lang` attribute.
- Any other mode's felt or media blocks.
- A polyfill or fallback layout for browsers without container queries.
- Running `politix-fit.cjs` in CI, or adding Playwright as a dependency.
- Real party logos, photographs, or a likeness of any real politician.

## Source

Not a rule or scoring change. The bounds this spec relies on are read from the code:

- `pxResolve`'s `badBurnout` refusal in `src/game/politix.ts`;
- `PX_SCANDAL_GROUPS` in `src/game/content.ts`;
- `PX_SCANDAL_DELTA` in `src/game/constants.ts`.

Their rule citations stand in `2026-11-04-rework-politix-three-parties`. Neither tuppi source knows
this game.
