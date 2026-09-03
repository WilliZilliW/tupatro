---
id: 2026-09-03-playable-on-a-phone-screen
title: Make the game playable on a phone screen without moving a pixel on a big one
kind: ui
status: proposed
---

# Make the game playable on a phone screen without moving a pixel on a big one

## What

On a phone-sized viewport the game cannot currently be played to the end of a deal. `#app`'s
`grid-template-rows:auto minmax(230px,1fr) auto` lets the stacked rail grow to its own content —
eleven plates including thirteen support rows — and `body{overflow:hidden}` means the felt and the
hand are pushed off the bottom with nothing to scroll them back; separately, `.hcard{touch-action:none}`
stops a finger panning `.handrow`, so the hand cards that sit past the right edge cannot be reached
at all. After this, at the phone sizes named below the felt and the whole hand are on screen at
once, every hand card, every decision-panel button and both rail buttons are reachable by touch,
and no trick card is clipped by or drawn on top of a seat.

The second half of the requirement is the harder half: **a viewport at least 821 px wide must be
pixel-identical to today**, and a mouse must still hover-raise and drag-reorder exactly as it does
now. Nothing about tuppi, scoring, money, the shop, the catalogues or any phase changes, and no
player-facing string is added.

## Acceptance criteria

- [ ] **The defect is measured before any CSS or HTML changes**, in Chrome device emulation at
      390×844, 360×740 and 844×390, with a run in `phase:"play"` and thirteen cards in hand. For
      each size record: `getBoundingClientRect()` for `.rail`, `.felt`, `.handzone` and `.handrow`;
      `.handrow`'s `scrollWidth` / `clientWidth` / `scrollLeft`; `document.scrollingElement`'s
      `scrollTop` and `scrollHeight` vs `clientHeight`; the computed `touch-action` of an `.hcard`;
      and whether each `.railbtns button` and the last `.hcard` has a rect inside the viewport. All
      three readings go in the pull request body next to the post-fix ones.
- [ ] **Felt and hand both on screen, portrait.** At 390×844 and 360×740, `phase:"play"`: `.felt`
      and `.handzone` rects satisfy `top >= 0` and `bottom <= innerHeight`, `.felt`'s rect height is
      at least 300 px, `document.scrollingElement.scrollTop === 0` with
      `scrollHeight <= clientHeight + 1`, and no descendant of `#app` has a rect with `right >
innerWidth + 0.5` or `left < -0.5`.
- [ ] **Every hand card is reachable by touch.** At 390×844 and 360×740, in `play` and in the
      spread phase `declare`: the computed `touch-action` on `.hcard` is not `none`, a synthesized
      horizontal touch pan begun on a card drives `.handrow.scrollLeft` to `scrollWidth -
clientWidth`, and afterwards `document.elementFromPoint()` at the last card's centre returns
      that card or a descendant of it.
- [ ] **Tap plays; the mouse drag survives.** At the phone profile, a tap on a playable `.hcard`
      removes it from `.handrow` and mounts it in a `.slot`. At 1280×800 with an ordinary mouse
      profile, `pointerdown` + a 20 px `pointermove` + `pointerup` on a hand card still changes the
      `data-uid` order in `.handrow` — drag-reorder is not removed for pointer devices.
- [ ] **The panel-scroll law holds on a phone.** At 390×844 and 844×390, in `declare` and in
      `swap`, with `#declpanel.scrollTop === 0`: every `#declpanel .row` button and every
      `.sidecard` has a rect inside the viewport and `document.elementFromPoint()` at its centre
      returns it or a descendant. `#declpanel` is still a descendant of `.felt` — it must not become
      an `Overlay`.
- [ ] **The rail's buttons stay reachable**, the delivered criterion of
      `2026-09-03-rail-buttons-and-localised-party-emblems` re-checked at 390×844, 360×740 and
      844×390 with `.rail.scrollTop === 0`: both `.railbtns button` rects are inside the viewport
      and hit-testable at their centres.
- [ ] **Nothing on the felt collides or clips.** At 390×844 and 844×390 with four cards played:
      each `.slot` rect is fully inside `.felt`'s border box, and no `.slot` rect intersects any
      `.seat` rect.
- [ ] **The overlays fit.** At 390×844, for `blindselect`, `shop`, `cashout`, the rules modal and
      the seed modal: no element inside `.overlay` has a rect wider than `innerWidth`, `.panel`'s
      rect satisfies `left >= 0` and `right <= innerWidth`, and `.overlay` scrolls to its own end.
      `.seedfield`'s computed `font-size` is at least 16 px at this width, so focusing it cannot
      zoom the page on iOS Safari.
- [ ] **Big screens do not move.** At 1280×800, 1280×500 and 1000×700 in a plain desktop pointer
      profile (no device emulation), the rects of `.rail`, `.felt`, `.handzone`, `.handrow`,
      `.hint`, every `.slot`, every `.seat` and `#declpanel` each differ from the pre-change
      baseline by less than 0.5 px in `top`, `left`, `width` and `height`, and the computed
      `touch-action` on `.hcard` is still `none`. Both readings go in the pull request body.
- [ ] **The diff is gated by media queries.** `git diff -U0 src/index.css` shows no added or
      changed declaration outside an `@media` block, except from this list, each occurrence named in
      the pull request body with its reason: `overscroll-behavior`, an `env(safe-area-inset-*)` term
      in a padding, `touch-action:manipulation`. No unmediated declaration is deleted or altered.
      The `@media (max-width:1080px)` block is untouched; the `@media (max-width:820px)` block may
      be edited, and any edit to it is reported with a before/after reading at 800×600. Any new
      `@media (max-height: …)` block uses a threshold below 500 px, so the project's short-window
      law at 1280×500 is unaffected. `src/index.css` stays in `.prettierignore` and
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"` must not start covering it.
- [ ] **The viewport meta, and a test that guards it.** `index.html`'s viewport meta reads
      `width=device-width, initial-scale=1, viewport-fit=cover` and contains neither
      `user-scalable=no` nor `maximum-scale`. `src/test/invariants.test.ts` gains a `describe` that
      reads `index.html` by path and asserts exactly that, and the case is shown to bite by adding
      `user-scalable=no` and failing — restoring by copy-aside-and-move-back, never
      `git checkout --` or `git stash`, because the tree holds uncommitted work. The failing output
      goes in the pull request.
- [ ] **No logic and no text move, and the gates are green.** `git diff --stat` shows no file under
      `src/game/` and no file under `src/i18n/`; neither catalogue gains a key. The existing
      `describe("the hand card raise")` in `src/test/invariants.test.ts` still passes with the new
      breakpoint's `.hcard` raise rules in its scope — its parser reads inside `@media` blocks
      already. `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass;
      the test counts in `README.md` and `CLAUDE.md` move with the suite; and the **"Mobile is
      unverified"** bullet under Known gaps in `CLAUDE.md` is rewritten to name exactly which sizes
      were verified and to say that no physical device was used.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Phone screen" is read as 360–430 CSS px wide in portrait and one landscape case**, tested in
  Chrome device emulation at **390×844** (iPhone 12–15 class), **360×740** (common Android) and
  **844×390** (the same phone rotated). No physical device is available to this pipeline, so every
  claim below is an emulation claim. 320 px wide (iPhone SE 1st generation) is deliberately not a
  target — see Out of scope.
- **"Shouldn't affect big screen experience" is read as a hard pixel invariant above 821 px wide.**
  The stylesheet already stacks the layout at `max-width:820px`, so that boundary is the project's
  own definition of "small" and is reused rather than invented. Viewports narrower than 821 px are
  therefore in scope and may change, including 800×600, which the previous spec used as a
  breakpoint test size; a change there is allowed but must be reported. If the reporter meant that
  a 1000×700 or an 800×600 window must also freeze, this is the sentence to challenge.
- **"Playable" is defined operationally, not by feel.** It means: felt and whole hand on screen
  without page scrolling, every hand card reachable, every decision panel's buttons reachable, both
  rail buttons reachable, no trick card clipped or covering a seat. It is **not** a claim that the
  game is comfortable or attractive on a phone. Comfort is subjective and cannot be a tick-box; the
  reviewer should judge it from the phone screenshots in the pull request body.
- **Drag-to-reorder is given up on touch devices, and that is a real loss.** `.hcard{touch-action:none}`
  is exactly what makes the pointer drag work and exactly what stops a finger panning the row —
  both gestures are horizontal on the same element. Making them coexist needs a long-press, and a
  long-press needs a timer, which this project permits only in `useGameLoop`. The chosen reading:
  on a touch-only device the finger pans the row and the sort buttons in `HandTools` do the
  ordering; on any pointer device the drag is untouched. `useHandDrag`'s `onPointerCancel → finish`
  already copes with the browser taking the gesture over. If reordering by finger is considered
  essential, argue with this bullet.
- **The fix is CSS plus the viewport meta.** No new game state field, no new phase, no component
  `useState` for a layout mode, no `matchMedia` in a component, no new `setTimeout`. A component
  change is allowed only if a media query provably cannot hold a criterion, and then it is named in
  the pull request.
- **The rail becoming a bounded, self-scrolling strip is the guessed mechanism** behind the
  second criterion, not a requirement. It follows from reading `#app`'s `grid-template-rows:auto
minmax(230px,1fr) auto` against `.rail`'s eleven stacked plates, but it was not confirmed in a
  browser at spec time. The implementer may reach the criterion another way; this is simply the
  route that was reasoned through, and the `.railbtns` sticky footer keeps working inside it.
- **Vertical space is assumed the binding constraint, not width.** The card size at the phone
  breakpoint should be chosen so all thirteen cards fit `.handrow` unspread (at 44 px wide with a
  −20 px overlap, 13 × 44 − 12 × 20 = 332 px, inside a 360 px viewport); the spread phases
  (`declare`, `soolioffer`, `swap`, `sooligive`) still overflow and rely on the pan.
- **Safe-area insets are assumed to matter and are guessed from the hardware, not observed.**
  `viewport-fit=cover` plus `env(safe-area-inset-*)` padding so the home indicator does not sit over
  the bottom of the hand row and a landscape notch does not cover the rail. Emulation reports no
  real insets, so this cannot be verified in this run and the reviewer should treat it as unproven.
- **Two things are refused even though they would make the criteria easier.** `user-scalable=no` or
  a `maximum-scale`, because blocking pinch-zoom is an accessibility regression; and swapping
  `100dvh` for `100svh`, because `dvh` already handles the URL bar and the cost — a reflow as the
  bar collapses — is accepted.
- **No delivered spec is contradicted; two overlap.**
  `2026-09-03-rail-buttons-and-localised-party-emblems` (commit `fc9f86e`) pinned `.railbtns`; that
  decision stands and is re-checked here at phone sizes rather than reversed.
  `2026-09-03-hand-card-raise-shifts-the-table` (commits `0960610`, `ac5ba2f`, `0f3cdc8`, `5c69cce`)
  fixed `.handrow` to a per-breakpoint height with room reserved for the raise, and its criterion
  said "no new media query is required" — that was a statement about _that_ change, not a ban. A new
  phone breakpoint **must** set `.handrow`'s height to the smaller card's reserved room by the same
  formula (16 + 0.065·h hovered, 18 + 0.078·h dragging) and must not reintroduce `min-height` or a
  visible horizontal scrollbar in that row. The overlap is the file and the rule; the earlier
  reading wins wherever the two touch.
- **Landscape is in scope at one size only**, 844×390. Any new `@media (max-height: …)` block must
  use a threshold below 500 px so a 1280×500 desktop window — the project's own short-window test
  size — is never caught by it.
- **Classified `ui`.** It changes layout and touch interaction only; it adds no rule, no score and
  no string. `ui` runs gates, audit, playtest and screen, and the screen stage is the only one that
  can check any of this. Its brief already says to look at ~360 px wide and to report mobile
  findings as information "unless the change itself claimed to address it" — this spec claims
  exactly that, so those findings are failures here.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/index.css` — a new phone breakpoint (`@media (max-width:560px)`) and, if landscape needs it,
  a short-window one below 500 px. Inside them: `#app`'s `grid-template-rows`; `.rail` (a bounded
  height with its own `overflow-y`, keeping the sticky `.railbtns`); `.tablewrap` / `.felt` padding
  and border; `.card` / `.hcard` size and overlap; `.handrow`'s `height` and `padding-top` (the
  reserved raise room, recomputed for the smaller card); `.handzone` padding; `.slot-n` `.slot-s`
  `.slot-w` `.slot-e` offsets; `.seat-w` / `.seat-e`; `.seedfield`'s `font-size`; `.overlay` /
  `.panel` padding; `.blinds` and `.shelf` column counts. Outside them, only the allowed list:
  `overscroll-behavior` on `body`, `.rail`, `.handrow` and `.overlay`, and `env(safe-area-inset-*)`
  padding. The file stays hand-formatted and in `.prettierignore`.
- `index.html` — the viewport meta gains `viewport-fit=cover`.
- `src/test/invariants.test.ts` — a new `describe` reading `index.html` by path (`ROOT` is already
  computed there; `filesUnder` walks `.ts`/`.tsx` only, so the file is read by path like
  `src/index.css` already is). The existing `describe("the hand card raise")` needs no edit: its
  `[^{}]` rule parser deliberately matches rules inside `@media` wrappers, so the new breakpoint's
  raise rules are already covered by it.
- `src/hooks/useHandDrag.ts` — expected unchanged. `onPointerCancel → finish(uid)` is what makes the
  browser taking over a pan safe; read it before changing `touch-action`.
- `src/components/hand/Hand.tsx` — expected unchanged. `SPREAD_PHASES` decides when the row
  overflows and therefore when the pan matters.
- `src/components/rail/Rail.tsx` — only if the bounded rail needs a wrapper element; the preferred
  fix changes no TSX and no class names.
- `CLAUDE.md` — the "Mobile is unverified" bullet under Known gaps, and the test count if it moves.
- `README.md` — the test count if it moves.

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- **A collapsible, tabbed or bottom-sheet rail.** Hiding the plates behind a control needs a
  catalogue key in both locales and a new interaction to review; it is a second decision on top of
  this one. Bound the rail's height instead.
- **Drag-to-reorder by finger.** See the assumption; `HandTools`' sort buttons cover ordering on
  touch.
- **Viewports narrower than 360 px**, including the 320 px iPhone SE 1st generation.
- **Accessibility semantics.** The cards remain focusable `div`s with no ARIA roles — a gap already
  listed in `CLAUDE.md` and not this change.
- **Touch targets above the WCAG 2.2 minimum of 24×24 CSS px.** Raising `.tinybtn`, `.sortbtn` and
  `.jk .sell` to 44 px would reshape the rail at every size, which the invariance criterion forbids.
- **The `.sidecard:hover` raise sticking after a tap on touch.** Cosmetic, in a different scroll
  container, and the same thing the hand-card-raise spec deliberately left in the rail.
- **Run persistence**, so a phone that backgrounds the tab still loses the run. A known gap.
- **Physical-device testing.** Emulation only; the pull request must say so.
- **Any rule, scoring, balance, AI or catalogue change**, and re-running the balance simulations —
  no number in `README.md`'s balance tables can move.
- **Reformatting `src/index.css` or bringing it into Prettier's scope.**

## Source

Not a rule or scoring change: no tuppi rule is read, reinterpreted or altered here. The Oulunsalo
senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>
describe the deck, the näyttö, rami/nolo, ryöstö and sooli, and say nothing about the size of the
screen the cards are drawn on, so no reading of them can be affected by a breakpoint.
