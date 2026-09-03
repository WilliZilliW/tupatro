---
id: 2026-09-03-hand-card-raise-shifts-the-table
title: Stop a raised hand card from moving the felt
kind: ui
status: proposed
---

# Stop a raised hand card from moving the felt

## What

Raising a card in your own hand — hovering it, focusing it with the keyboard, or picking it up to
reorder — currently shifts the felt and everything drawn on it upwards, so the table jumps while
the player is only looking at a card. After this, the layout above the hand is pixel-identical
whether a hand card is raised or not, at every window size the project checks, and the raised card
is no longer clipped at the top of the hand row.

Nothing about tuppi, scoring, money, the shop, the catalogues or any phase changes. The raise
itself stays: it is the only affordance that says a card is playable.

## Acceptance criteria

- [ ] **The defect is measured before any CSS changes**, in a real browser at 1280×800 with a run
      in `play` and thirteen cards in hand: with the pointer away from the hand, and then with the
      pointer physically over the middle `.hcard.playable` (a real mouse move, so `:hover`
      applies), record `.felt`'s `getBoundingClientRect()` `top` and `height`, `.handzone`'s
      `height`, `.handrow`'s `scrollTop` / `scrollWidth` / `clientWidth` / `clientHeight`, and
      `document.scrollingElement.scrollTop`. Both readings, and which of them differ, go in the
      pull request body. If nothing differs, repeat at 1000×700 and at 1216×800 (a width where the
      spread hand is within a few px of the row's full width) before concluding, and say so.
- [ ] After the fix, at 1280×800, 1280×500, 1216×800 and 1000×700: `.felt`'s rect `top` and
      `height` and `.handzone`'s rect `height` differ by less than 0.5 px between "no card raised"
      and each of the three raises — pointer hover over a playable card, keyboard `:focus-visible`
      on a card reached by Tab, and a card mid-drag (`pointerdown` then a 20 px `pointermove`, the
      `.hcard.dragging` state).
- [ ] In the same four sizes and three raises, `document.scrollingElement.scrollTop` and
      `.handrow.scrollTop` are `0` both before and after the raise: nothing scrolls the page or the
      hand row as a side effect of a card being raised.
- [ ] The raise is still visible and no longer clipped: with the middle playable card hovered, its
      rect `top` is at least 14 px above its unhovered rect `top`, and greater than or equal to
      `.handrow`'s padding-box top, so `overflow-y:hidden` cuts nothing off the raised card. The
      same holds for the `.hcard.dragging` raise.
- [ ] `src/index.css`'s `.handrow` rule reserves room for the largest raise and a stable inline
      gutter, with a comment saying why. The room needed is `translateY` plus the growth that
      `transform-origin:50% 130%` gives the scale: 16 + 0.065·h for hover and 18 + 0.078·h for
      dragging, i.e. ~26 px at the default 94 px card. A horizontal scrollbar appearing in the row
      must not be able to change `.handzone`'s height. `src/index.css` stays hand-formatted and
      listed in `.prettierignore`; `npx prettier --check "**/*.{ts,tsx,json,md,html}"` must not
      start covering it.
- [ ] The reserved room follows the card size through both existing breakpoints: at 800×600
      (cards 50×72, inside the `max-width:820px` block) and at 1000×700 (cards 56×80, inside
      `max-width:1080px`), the hovered card is not clipped and `.felt`'s height is unchanged by the
      raise. No new media query is required.
- [ ] `src/test/invariants.test.ts` gains a case that reads `src/index.css` and asserts every rule
      whose selector matches `.hcard` together with `:hover`, `:focus-visible` or `.dragging`
      declares only properties that cannot reflow a sibling or a parent — `transform`,
      `transform-origin`, `z-index`, `box-shadow`, `filter`, `opacity`, `outline`, `cursor`,
      `transition`, `animation`, `will-change`. Note `filesUnder` currently walks `.ts`/`.tsx`
      only, so the stylesheet is read by path.
- [ ] That new case is shown to bite: adding `margin-top:-16px` to `.hcard.playable:hover` makes it
      fail, and the file is restored by copy-aside-and-move-back, never `git checkout --` or
      `git stash` (the tree holds uncommitted work). The failing output goes in the pull request.
- [ ] The diff touches no game logic: `git diff --stat` shows no file under `src/game/`, no
      `src/i18n/` file, and no new key in either catalogue. No new player-facing string is added, so
      `src/i18n/i18n.test.ts` and `src/test/render.test.tsx` need no new fixtures — both still pass
      unchanged unless the test count is what changed them.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`. If the test
      count moves, the counts in `README.md` and `CLAUDE.md` move with it.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"The table graphic" is read as `.felt` and everything drawn on it** (`Seats`, the trick slots,
  `ModeBox`, `center-msg`, `ScorePop`) — the felt panel is the only graphic above the hand. If the
  reporter meant something else moving, this is the sentence to challenge.
- **"When card raises" is read as a card in your own hand being raised**: `.hcard.playable:hover`,
  `.hcard.playable:focus-visible` and `.hcard.dragging` in `src/index.css`. It is **not** read as
  the drop animation of a card played to the felt (`@keyframes drop`, `.slot .card.fresh`), which
  is clipped inside `.felt` and cannot move it, nor as the `.sidecard` raise in the rail.
- **The bug was not reproduced while writing this spec, and that is a real hole.** No browser was
  available at spec time, and the raise is transform-only, so by itself it cannot reflow anything —
  which is exactly why the first criterion is a measurement rather than a fix. Two mechanisms are
  live, and the implementer must find out which before touching CSS:
  - **A, a scrollbar toggling.** `.handrow` is `overflow-x:auto`. The hover scale widens the row's
    scrollable overflow by ~3.3 px (1.05 × 66 px) and the drag scale by ~4 px, so at a window width
    where the row is within a few px of full, a classic (non-overlay) horizontal scrollbar appears
    on hover. `#app` is `grid-template-rows:minmax(0,1fr) auto`, so a taller `.handzone` takes
    height straight off the felt row and the felt's centred contents rise. The spread hand is the
    widest case: 13 × 66 px + 12 × 4 px = 906 px. On macOS with overlay scrollbars this shows
    nothing, which may be why it survived review.
  - **B, a scroll into view on focus.** `.handrow` has `padding-top:12px` but the hover raise needs
    ~22 px and the drag raise ~25 px, so the raised card overflows the row's scrollport top by
    ~10–13 px today. `.handrow` is `overflow-y:hidden` and therefore still programmatically
    scrollable, and `body` is `overflow:hidden` while the document remains scrollable too; a
    browser revealing a focused card can scroll either, moving everything above it.
  - If **neither** reproduces at any of the four sizes, say so in the pull request and deliver the
    reserved-room and invariance criteria anyway — they are correct regardless. The reviewer should
    then read this bullet as the warning it is: a fix may be landing for a symptom nobody has seen
    twice.
- **This is read as a layout bug, not as a request to change the raise.** The raise keeps its
  direction and roughly its size; removing it, shrinking it to a shadow, or replacing it with an
  outline is out of bounds.
- **A constant offset is accepted in exchange for the jump.** Reserving ~26 px instead of 12 px
  makes `.handzone` about 14 px taller for the whole run and the felt correspondingly shorter,
  always. That is the trade this spec chooses: a felt 14 px shorter is invisible, a felt that moves
  is not. At 1280×500 the felt must still leave the decision panels usable — the project's 500 px
  law applies unchanged.
- **The fix is CSS.** No hover state in React, no measuring in a component, no `setTimeout`
  (`useGameLoop` is the only call site), no new state field. A `.handzone`/`#app` grid change is
  allowed only if reserving room inside `.handrow` provably cannot hold the invariance.
- **The clipped raise is treated as part of the same defect.** Both come from the same missing
  reserved room, and fixing the shift without the clipping would mean touching the rule twice. A
  reviewer who considers the clipping acceptable should argue with the padding criterion.
- **`scrollbar-gutter:stable` or reserved padding is assumed acceptable**, i.e. the row may show a
  permanent few-pixel inline gutter rather than gaining and losing one. It is the same trade as the
  height.
- **No spec is contradicted.** `2026-09-03-party-emblems-and-support` and
  `2026-09-03-rail-buttons-and-localised-party-emblems` are both delivered (`862313e`, `fc9f86e`).
  The second also edits `src/index.css`, but only `.railbtns` and only in the rail column; this
  spec touches `.handrow`, the `.hcard` raise rules and the two media blocks. The overlap is the
  file, not a rule, and the sticky-footer decision there stands.
- **The four window sizes were chosen here**, not given: 1280×800 (an ordinary laptop), 1280×500
  (the project's own short-window law), 1216×800 (near the spread row's full width, where
  mechanism A is most likely) and 1000×700 / 800×600 (the two responsive breakpoints).
- **Nothing about balance or the rules moves**, so no simulation is re-run and `README.md`'s
  measured figures are untouched. The `balance` stage is correctly not run for a `ui` kind.
- **Classified `ui`.** It is layout and interaction only; `ui` runs gates, audit, playtest and
  screen, which is the widest set available for a change that adds no rule and no string.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/index.css` — `.handrow` (`padding-top`, `min-height`, the inline gutter, plus the comment
  recording why the room exists); the `.hcard`, `.hcard.playable:hover,.hcard.playable:focus-visible`
  and `.hcard.dragging` rules stay transform-only; the `max-width:1080px` and `max-width:820px`
  blocks, where the card drops to 80 px and 72 px tall and the reserved room must follow. The dead
  `.hcard.pick:hover` rule is nearby — see Out of scope.
- `src/test/invariants.test.ts` — a new `describe` reading `src/index.css` by path (`ROOT` is
  already computed there; `filesUnder` walks `.ts`/`.tsx` only) and asserting the raise rules
  declare no layout-affecting property.
- `src/components/hand/Hand.tsx` — only if the invariance genuinely needs a wrapper element around
  `.handrow`; the preferred fix changes no TSX and no class names, so `SPREAD_PHASES` and the
  `cx("handrow", …)` call stay as they are.
- `README.md`, `CLAUDE.md` — the stated test count, and only if it changes.

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- The `.sidecard:hover` / `.sidecard.picked` raise in the rail's `SideDeckBox` and in `SwapPanel`.
  It is the same shape of risk inside a different scroll container (`.rail` is `overflow-y:auto`),
  but it is a separate measurement and a separate fix. Fix it here only if the measurement in the
  first criterion shows the rail shifting too, and then say so in the pull request.
- Removing the dead `.hcard.pick:hover` rule in `src/index.css`. No component puts a `pick` class
  on an `.hcard` — `SwapPanel` uses `.sidecard` — so the rule is unreachable, but deleting dead CSS
  is not this defect.
- The played-card drop animation (`@keyframes drop`, `.slot .card.fresh`) and the `ScorePop` rise.
- Redesigning the hand: card size, the `-13px` overlap, the spread-phase spacing, the sort tools or
  the drag interaction in `src/hooks/useHandDrag.ts`.
- Rewriting `#app`'s grid, giving the hand a fixed pixel height, or making the felt a fixed aspect
  ratio, unless reserving room in `.handrow` cannot hold the invariance.
- Accessibility semantics for the hand (ARIA roles, real buttons instead of focusable divs) — a
  known gap, unchanged here.
- Phone verification and any new breakpoint; mobile stays unverified per `CLAUDE.md`.
- Anything under `src/game/`, any catalogue key, any rule, any scoring order and any balance
  figure.
- The rail-button reachability and localised emblem work delivered by
  `2026-09-03-rail-buttons-and-localised-party-emblems`; `.railbtns` is not touched.

## Source

Not a rule or scoring change: no tuppi rule is read, reinterpreted or altered here. The Oulunsalo
senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>
describe the deck, the näyttö, rami/nolo, ryöstö and sooli, and say nothing about how a hand is
drawn on a screen, so no reading of them can be affected by where the hand row reserves its pixels.
