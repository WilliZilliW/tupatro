---
id: 2026-09-05-swipeable-rail-pages-on-phone
title: Split the phone rail into five horizontally swipeable pages
kind: ui
status: proposed
---

# Split the phone rail into five horizontally swipeable pages

## What

On a phone the rail is a 253 px strip that scrolls **869 px** of content vertically (measured in
Chrome emulation at 390×844 on commit `5e04736`; 222 px of strip at 360×740, same 869 px inside).
Nine of the eleven plates are below the fold at any moment, and the only way to see the tally, the
jokers or the support list is to scroll a wooden strip that gives no sign it scrolls. After this,
at `max-width:560px` the plates are laid out as **five pages side by side in a horizontal
scroller**, one page filling the strip, and a finger swipe moves between them: 1 Blind
(`BlindPlate` + `Slate`), 2 Deal (`Tally` + `Stats`), 3 Kit (`JokerList` + `SideDeckBox` +
`ConsumablesBox`), 4 Support (`SupportBox`, two columns at this width), 5 Game (the seed chip, the
language button and the Rules / SCORES / New game footer). A row of five dots below the strip says
which page is showing and jumps to any other, and the rail opens on page 1.

Those five are the order **a finger** meets, which is not the DOM order: one wrapper has to hold
both the seed chip and the Rules / SCORES / New game footer, and those are DOM positions 2 and 11,
so the game page is written second and `.rp-game{order:1}` moves it last on the strip. The dots and
the scroll index follow the swipe order, so dot 1 is the blind.

The mechanism is CSS scroll snap and nothing else: the pages are wrapped in `.railpage` elements
that are `display:contents` at every width except the phone query, so at 821 px and wider, in the
820 px wrapping row and in the landscape short-window block, the flex items of `.rail` are exactly
today's eleven boxes in today's order. There is no gesture code, no new `touch-action` rule and no
scroll library — the swipe, the momentum, the keyboard arrows and the scrollbar are the browser's.
The page index is component-local `useState` in `Rail.tsx`; it is **not** a `GameState` field and
**not** in the save snapshot, so `SAVE_VERSION` does not move.

**Relation to delivered specs.** `2026-09-03-playable-on-a-phone-screen` put "a collapsible,
**tabbed** or bottom-sheet rail" under Out of scope, with the reason that hiding plates behind a
control "needs a catalogue key in both locales and a new interaction to review; it is a second
decision on top of this one". This spec **is** that second decision, taken deliberately: it
overrides that line, it adds no catalogue key (the indicator is dots, not words), and the
interaction is specified and measured here. Nothing else in that spec is reversed — its felt-height
floor, its hand pan, its `touch-action`, its safe-area padding and its `.railbtns` sticky footer all
still hold, and two of its criteria are re-checked below. `2026-09-03-rail-buttons-and-localised-party-emblems`
pinned `.railbtns` as a sticky footer and `2026-09-04-view-the-scoreboard-any-time` put a third
button in it; both keep their behaviour at every width where the rail is still a column, and on a
phone the footer becomes ordinary content of page 5. `2026-09-03-party-emblems-and-support` fixed
the `SupportBox` order and the 13 rows; the two-column phone layout re-flows them and must not
re-sort them.

**Two things in the requirement do not survive measurement, and this spec resolves both against
it.** They are the first two entries under Assumptions and the reviewer should read them before the
diff.

## Acceptance criteria

- [ ] **The baseline is re-measured before any edit**, in Chrome emulation (`--headless=new`, device
      metrics override, `mobile:true`) at 390×844, 360×740 and 844×390, and again at 1280×800,
      1280×500, 1000×700 and 800×600, on the tip of `main`. For each size record
      `getBoundingClientRect()` for `.rail`, `.felt`, `.handzone`, `.handrow` and **every child of
      `.rail`**, plus `.rail`'s `scrollHeight` / `clientHeight`. Do it twice on the phone sizes: once
      at `screen.kind === "blindselect"` and once in `phase: "play"` at `blindIdx: 3` with a boss and
      `g.mode` set, because `.bossnote` and `.slate .needline` exist only in the second and they are
      what decides the rail's height. This reading reproduces, at 390×844 blind select: `.rail`
      253.2, `scrollHeight` 869, children 29 / 25 / 66 / 125.3 / 79 / 45 / 33 / 38 / 38 / 246.6 / 54
      with an 8 px gap. All readings go in the pull request body beside the post-change ones.
- [ ] **The five pages exist in the DOM at every width, with a stable class each.**
      `src/components/rail/Rail.tsx` renders `.railstrip` holding, in DOM order,
      `.railpage.rp-game` (`.railtop` then `.railbtns`), `.railpage.rp-blind`, `.railpage.rp-deal`,
      `.railpage.rp-kit`, `.railpage.rp-support`, and `.brand` stays a direct child of `.rail` before
      the strip. A render test on `<Rail />` asserts: exactly five `.railpage`; `.rp-blind` contains
      `.blindplate` and `.slate`; `.rp-deal` contains `.tallies` and `.stats`; `.rp-kit` contains
      `.jokers`, the side-deck box and the consumables box; `.rp-support` contains `.support` with 13
      `.supportrow` in `PARTIES` order; `.rp-game` contains `.seedchip`, `.langbtn` and `.railbtns`.
      `container.querySelectorAll(".railbtns button")` is still **exactly 3** and the existing SCORES
      click test at `src/test/render.test.tsx:444` passes unedited. The DOM order above is the tab
      order and is not the swipe order: `.rp-game{order:1}` inside the phone query puts the game page
      last on the strip, so a finger meets blind, deal, kit, support, game, and a render test asserts
      the five dots address the pages in **that** order.
- [ ] **`display:contents` alone does not preserve the wide layouts, and the two rules that repair it
      are written.** `.railstrip` and `.railpage` are `display:contents` outside the phone query;
      `src/index.css:593` `.rail > *{flex:1 1 190px}` becomes a selector that also reaches the
      wrapped plates (`.rail > *, .railpage > *{...}`, kept **before** the `.railbtns` rule that
      overrides `flex-basis`); and `.railbtns{order:1}` is added so the footer stays last although
      its wrapper now sits second in the DOM. `.raildots` is `display:none` outside the phone query,
      so it is not a flex item there.
- [ ] **Nothing moves at 821 px and wider, at 800×600, or in landscape.** At 1280×800, 1280×500,
      1000×700, 800×600 and 844×390 every rect recorded in the baseline — `.rail`, `.felt`,
      `.handzone`, `.handrow` and each of the eleven boxes now reached through the wrappers — is
      identical to the pre-change reading within 0.5 px, in the same visual order, and `.railbtns` is
      still `position:sticky` with its rect at the bottom of the rail's scrollport with
      `.rail.scrollTop === 0` and again at `.rail.scrollTop === .rail.scrollHeight`. No declaration
      outside `@media (max-width:560px)` changes except the two named in the previous criterion and
      the `display:contents` / `display:none` defaults for the three new classes.
- [ ] **The strip is the only scroller on a phone, and it holds exactly five snap positions.** Inside
      `@media (max-width:560px)`: `.rail` has a **`height`** (not `max-height`) that cannot move as a
      mobile browser's URL bar hides — a `px` clamp on `svh`, never `dvh` — and `overflow-y:hidden`; `.railstrip` is `display:flex; overflow-x:auto; overflow-y:hidden;
scroll-snap-type:x mandatory; overscroll-behavior:contain`; each `.railpage` is `flex:0 0 100%;
scroll-snap-align:start; min-height:0`; and `.railbtns`' negative side margins are neutralised
      inside a page. Measured at 390×844 and 360×740: `.railstrip.scrollWidth` equals
      `5 * .railstrip.clientWidth` within 1 px; setting `scrollLeft` to `i * clientWidth` for
      `i = 0..4` puts the `left` of the `i`-th page **in swipe order** within 1 px of the strip's own
      `left`, and lights the `i`-th dot; `.rail.scrollTop`
      stays `0` and `.rail.scrollHeight <= .rail.clientHeight + 1`;
      `document.scrollingElement.scrollTop === 0` with `scrollHeight <= clientHeight + 1`; and no
      descendant of `#app` **outside `.railstrip`** has a rect with `right > innerWidth + 0.5` or
      `left < -0.5`. The four pages waiting off-screen break that bound by design and every
      horizontal carousel does — the clause is about what the strip must not push out with them: the
      felt, the hand, the dots and the wood around them.
- [ ] **Each page fits the strip, and the felt keeps its floor.** The rail's height and the three
      numbers in it are recorded in the pull request with the measurement that produced them. At
      390×844, 360×740, **375×667** (iPhone SE) and **360×640**, in the blind-select state **and** in
      `phase:"play"` on a non-boss blind: `.rp-deal`, `.rp-support` and `.rp-game` each have
      `scrollHeight <= clientHeight + 1` — none of the three can scroll, so anything over that box is
      unreachable; `.rp-support` draws its 13 rows in two columns (each `.supportrow` rect's
      `right <= .support` rect's `right + 0.5`, and the 13 rows occupy at most 7 distinct `top`
      values); and `.felt`'s rect height is **at least 300 px**, the delivered criterion of
      `2026-09-03-playable-on-a-phone-screen`, at 390×844 and 360×740 in both states and at 375×667
      in the blind-select state. **One measured size does not reach it and this criterion says so
      rather than dropping the size**: at 360×640 the support page's 218 px floor leaves `.felt` at
      289.5 px in blind select, where the pre-change rail left 315.5 px. A page that cannot scroll
      must fit, an unreachable support row is a bug and 10 px of felt is not, so the floor wins — and
      that is the single size and state where this change takes the felt under a bound the earlier
      build cleared. In `phase:"play"` every phone shorter than 740 px was already under 300 px
      before the pages (286.4 px at 375×667, 267.5 px at 360×640). `.rp-kit` and `.rp-blind` are the two
      pages that may exceed their box: the kit once jokers, side-deck cards or consumables are held,
      and the blind at every size, because 197 px of blind plate and slate do not fit the 190 px a
      strip that keeps the felt at 300 px can offer at 360×740 (**measured**: 197/190 in blind
      select, 219/190 in play, and no rail height clears both bounds at once). Both carry
      `overflow-y:auto; overscroll-behavior:contain` and no other page does. Post-change `.felt` and
      `.rail` heights at all four sizes go in the pull request beside the baseline.
- [ ] **Five dots, no words, no new catalogue key.** `.raildots` is a direct child of `.rail`
      rendered after the strip and holds exactly five `button type="button"` elements of class
      `raildot`, each with empty `textContent`, no `title` and no `aria-label`. A render test asserts
      `.raildots button` has length 5 and equals the number of `.railpage`, that every one has
      `textContent === ""`, and that `src/i18n/fi.ts` and `src/i18n/en.ts` are byte-unchanged on the
      branch; `src/i18n/i18n.test.ts` passes unedited and the two-language sweep in
      `src/test/render.test.tsx` stays green.
- [ ] **A dot scrolls its page into view, and the call is safe in jsdom.** Clicking dot `i` calls
      `scrollIntoView({ block: "nearest", inline: "start" })` on the `i`-th page element, reached
      through a ref array — `Rail.tsx` contains no `document.` and no `window.`. jsdom does not
      implement `Element.prototype.scrollIntoView` (verified: the property is `undefined`), so the
      call is written optionally (`el?.scrollIntoView?.(…)`) with a comment saying why. Two render
      tests: with `Element.prototype.scrollIntoView` stubbed by `vi.fn()`, clicking the fourth dot
      calls it exactly once with `{ block: "nearest", inline: "start" }` and on the fourth page **in
      swipe order**, which is `.rp-support` and `.railpage` index 4 in the DOM; a second test clicks
      all five dots and asserts they address `.rp-blind`, `.rp-deal`, `.rp-kit`, `.rp-support`,
      `.rp-game` in that order; with the stub removed, the same click does not throw.
- [ ] **The active dot follows the strip's scroll, and nothing else moves it.** `Rail.tsx` holds one
      `useState` for the index and an `onScroll` handler on `.railstrip` that sets it to
      `Math.round(scrollLeft / clientWidth)` clamped to `0..4`, with a guard clause returning early
      when `clientWidth` is `0` so the index is never `NaN`. Exactly one dot carries the active class
      at a time; a render test asserts the first dot is active on mount, fires `scroll` on the strip
      with `clientWidth` and `scrollLeft` stubbed to select page 3, and asserts the active class
      moved to dot 3 and off dot 1. Measured in the browser at 390×844: after a synthesized swipe
      from page 1 to page 2 the strip settles at exactly one snap position and the active dot is the
      second.
- [ ] **The page does not switch itself.** `Rail.tsx` contains no `useEffect` that scrolls the strip
      or sets the index from game state. A render test renders `<Rail />` at `phase:"declare"` with
      `scrollIntoView` stubbed, re-renders the same tree at `phase:"play"`, `phase:"shop"` and with a
      different `blindIdx`, and asserts the stub was never called and the active dot did not change.
- [ ] **The index is local UI state and reaches no saved byte.** `git diff` on the branch shows no
      change to `src/game/types.ts`, `src/game/state.ts`, `src/game/actions.ts`, `src/game/save.ts`,
      `src/game/reducer.ts` or any other file under `src/game/`; `SAVE_VERSION` is unchanged;
      `src/game/save.test.ts` and `src/test/invariants.test.ts` pass unedited, including "defines
      every state field in createRun", "has no module-level mutable state" and the single-`setTimeout`
      check — the scroll handling adds no timer and no `requestAnimationFrame`.
- [ ] **The docs stop describing a rail that no longer exists on a phone.** `CLAUDE.md`'s
      "Mobile is verified in emulation only" gap states that below 560 px the rail is five swipeable
      pages with a height in pixels, names the pages in swipe order, the two that may scroll and the
      floor the support page puts under the height, and records the
      new emulation readings and that no physical device was used; its `components/rail/*` row names
      the strip, the pages and the dots; the UI-rules section gains the reason `.rail > *` had to be
      widened, so the next wrapper does not silently break the 820 px row. `README.md`'s two
      sentences that place things "at the top of the left rail" (the seed) and "at the bottom of the
      left rail" (the party support) say where they are on a phone. The test count in `CLAUDE.md` and
      `README.md` is updated to the number `npm test` prints.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The rail's height goes up, not down. The requirement's "if the pages fit in less than the
  current `max-height:30dvh`, lower the cap so the felt gains the difference" branch is measurably
  false, and this spec takes the other branch.** Measured at 390×844 in the blind-select state,
  page 1 alone is 66 + 8 + 125.3 = **199.3 px** of content, while the strip can offer only
  250 − 10 (padding) − 29 (`.brand`) − 8 − ~16 (dots) − 8 ≈ **179 px** inside today's 253.2 px rail,
  and ~148 px inside the 222 px rail at 360×740. In `phase:"play"` page 1 grows further by
  `.slate .needline` (~22 px) and, on a boss blind, `.bossnote` (~39 px at this width). The rail is
  therefore given a **height in pixels, larger than today's cap**, and the felt loses that
  difference. The bound is hard: the height must keep `.felt` at 300 px or more at 360×740, which
  measures out at 258 px. **The felt gets smaller on a phone. That is the price of the pages and it
  should be looked at in a screenshot before the diff is approved.**
- **One number cannot be the height, because `30dvh` scaled with the viewport and a `px` does not.**
  A flat 258 px is 30 % of a 844 px phone and 39 % of a 667 px one, and measured on the first build
  it took `.felt` at 375×667 (iPhone 8 / SE2 / SE3, a live size) from 334.4 px to 276.5 px — under
  the 300 px floor, at a size the spec had not measured. The height is therefore
  `clamp(218px, 100svh - 434px, 258px)`, all three numbers measured: **258 px** is the ceiling
  360×740 set, **218 px** is the floor the support page sets (it has no scroll of its own; its two
  columns need 150 px of strip, and at 216 px the last row is clipped with nothing to reach it), and
  **434 px** is what the rest of the column costs, so between the two the rail leaves the felt
  exactly 301.5 px. That holds down to a 651 px-tall viewport; below it the support page's floor
  wins and the felt shrinks with the phone. `svh`, not `dvh`: it is the viewport with the URL bar
  shown and does not move when the bar hides, which is the whole reason a `px` was asked for.
- **The safe-area inset is added to the rail's height, not folded into its padding.** `box-sizing`
  is `border-box`, so `padding-top:calc(8px + env(safe-area-inset-top))` on a fixed height takes the
  inset out of the strip — and the pages that cannot scroll would silently clip on exactly the
  devices that report an inset, which emulation never does. The height carries it instead
  (simulated at 44 px: the strip keeps its own height and no page overflows).
- **Page 1 is allowed to scroll as well as page 3, which contradicts "Kit may scroll only".** With a
  boss note and a needline, page 1 is ~260 px of content and no rail height that keeps the felt above
  300 px at 360×740 can hold it. Between breaking a delivered criterion (`.felt >= 300px`) and
  breaking a sentence in this requirement, the delivered criterion wins: `.rp-blind` gets
  `overflow-y:auto` on the same terms as `.rp-kit`. On an ordinary blind neither scrolls.
- **A `px` height computed from `svh` replaces `30dvh`.** `dvh` changes as a mobile browser's URL
  bar hides, which would resize the rail and the felt mid-swipe; the requirement asks for a fixed
  height so swiping never moves the felt, and `dvh` cannot deliver that. `svh` is static, so the
  height is fixed for a given phone and still scales between phones. This is a behaviour change on a
  phone beyond the paging itself.
- **`.brand` is on no page.** The title and the "ANTE n/10" line stay a direct child of `.rail`
  above the strip and are visible on all five pages. The requirement's list of five pages does not
  mention them, and hiding the ante behind a swipe would be worse than the 29 px it costs.
- **`.railtop` moves in the DOM, and the desktop keyboard tab order changes with it.** Page 5 must
  hold both the seed chip and the footer buttons, which are DOM positions 2 and 11 today — a single
  wrapper cannot span them. The page-5 wrapper is therefore placed where `.railtop` is today
  (second), `.railbtns` moves inside it, and `.railbtns{order:1}` restores the visual order at every
  width. The consequence at 821 px and wider: **tabbing now reaches Rules / SCORES / New game before
  the joker sell buttons and the consumable buttons**, where today it reaches them after. Pixels are
  unchanged; the focus sequence is not. The alternative — page 5 last in the DOM with
  `.brand{order:-2}` and `.railtop{order:-1}` — moves the seed chip to the end of the tab order
  instead, which is worse, and needs two rules rather than one.
- **On a phone that DOM position is corrected with `order`, so the rail opens on the blind.** Left
  alone, DOM order is swipe order and the strip rests at `scrollLeft:0` on the game page: the blind,
  the target and the running score would each be a swipe away, against `CLAUDE.md`'s "most important
  content first in a panel". `.rp-game{order:1}` inside the phone query is one rule and moves it
  last, and the dots and the scroll index are indexed by the swipe order rather than the DOM's. The
  price is that on a phone the tab order (game first) and the swipe order (game last) differ; that
  sits inside the accessibility gap the unlabelled dots are already in.
- **`display:contents` on its own does not make the wide layouts byte-identical**, contrary to the
  requirement's reasoning. `.rail > *{flex:1 1 190px}` in the 820 px block matches the wrappers,
  which generate no box, so the plates would lose their 190 px flex basis and the wrapping row at
  800×600 would collapse to one column. The selector is widened; the 800×600 invariance criterion is
  what proves it.
- **`scrollIntoView` is called with `{ block: "nearest", inline: "start" }`, not the bare
  `{ inline: "start" }` of the requirement.** Without `block`, a browser is free to scroll ancestors
  vertically to bring the page into view, which is exactly the felt movement the requirement forbids.
  `behavior` is left unset, so the browser's default (instant) applies and `prefers-reduced-motion`
  needs no new rule.
- **The dots have no accessible name.** The requirement says no words and no new i18n keys, so they
  ship as five unlabelled buttons. This sits inside the accessibility gap `CLAUDE.md` already
  declares; it is not closed here and a reviewer who disagrees should say so now, because the fix is
  two catalogue keys.
- **The dots are a `.raildots` row below the strip**, ~16 px tall, costing the felt that height.
  Folding them into the `.brand` line would save it but crowds the ante against the title at 360 px
  wide.
- **The Kit page's scroll is vertical, inside the page**, with `overscroll-behavior:contain` so a
  finger that reaches its end does not chain out to the horizontal strip or the browser's
  pull-to-refresh.
- **The active-dot index is derived from `scrollLeft / clientWidth`, not from an
  `IntersectionObserver`.** Rounding is enough at one page per viewport, and it needs no new
  observer lifecycle to review.
- **Verification is Chrome device emulation only, as in every phone change before this one.** No
  physical device, so how the snap and the momentum actually feel, and `env(safe-area-inset-*)`,
  stay unproven. The pull request must say so.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/components/rail/Rail.tsx` — the strip, the five `.railpage` wrappers, the `.raildots` row,
  the ref array, one `useState` for the index and the `onScroll` handler. `.railtop` and `.railbtns`
  move inside the page-5 wrapper; no plate component changes.
- `src/index.css` — three new default rules (`.railstrip`/`.railpage` `display:contents`,
  `.raildots` `display:none`), `.railbtns{order:1}`, the widened `.rail > *` selector at line 593,
  and the phone block at `@media (max-width:560px)`: `.rail`'s clamped height, its safe-area inset
  and `overflow-y:hidden`, the strip's flex/snap/overscroll, `.railpage` sizing, `.rp-game{order:1}`,
  `.rp-kit` and `.rp-blind` overflow,
  `.rp-support .support` two columns, the neutralised `.railbtns` margins, and the dot row. The
  landscape block at `@media (max-height:480px) and (max-width:920px)` is untouched.
- `src/components/rail/SupportBox.tsx` — only if the two-column layout needs a wrapper element; the
  preferred route is CSS on the existing `.support` container, and the 13 rows keep their `PARTIES`
  order and their `.supportrow` / `.pbadge` / `.pname` / `.pnum` structure.
- `src/test/render.test.tsx` — the page-composition test, the dot count and empty-label test, the
  dot-click test with and without a `scrollIntoView` stub, the active-dot test, and the
  no-auto-switch test. The existing `VIEWS` sweep and the `.railbtns button` assertions stay as they
  are.
- `CLAUDE.md` — the mobile known gap, the `components/rail/*` row, the "UI rules learned the hard
  way" note about `.rail > *`, and the test count.
- `README.md` — where the seed and the party support live on a phone, and the test count.

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- **Any change at 561 px and wider**, landscape included. The 844×390 short-window layout keeps
  today's vertical rail, and the 800×600 wrapping row keeps its plates and its footer line.
- **Gesture code.** No pointer handlers, no drag-to-page, no scroll library, no new `touch-action`
  rule. The browser's scroller is the whole mechanism.
- **Auto-switching the page on a phase change, a toast, a boss reveal or a purchase.** A rail that
  moves under a thumb is a separate decision and a separate spec.
- **Putting the page index on `GameState` or in the save snapshot**, and any `SAVE_VERSION` bump.
- **New player-facing text**, including `aria-label`s and `title`s on the dots, and any edit to
  `src/i18n/fi.ts` or `src/i18n/en.ts`.
- **Accessibility semantics** — no `role="tablist"`, no roving tabindex, no ARIA on the dots or the
  pages. Named as an assumption, still the gap `CLAUDE.md` declares.
- **Redesigning any plate to be shorter**, in particular shrinking `.slate`'s type or hiding the
  `.needline` or the `.bossnote`. The rail's height and two scrollable pages absorb the overflow
  instead.
- **Viewports narrower than 360 px**, and any rule, scoring, balance, AI or content change — no
  number in `README.md`'s balance tables may move.
- **Physical-device testing**, and `env(safe-area-inset-*)` verification beyond what emulation shows.
- **Reformatting `src/index.css` or bringing it into Prettier's scope.**
