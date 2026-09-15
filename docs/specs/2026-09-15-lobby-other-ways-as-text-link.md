---
id: 2026-09-15-lobby-other-ways-as-text-link
title: Draw the lobby's Other ways to connect as a low-emphasis text link, not a full-weight button
kind: ui
status: proposed
---

# Draw the lobby's Other ways to connect as a low-emphasis text link, not a full-weight button

## What

On the lobby's first page — the chair table a player lands on from the start menu's **Multiplayer**
door — **Other ways to connect** stops being drawn as a button of the same weight as **Open a room**
and **Join a game**, and is drawn as a small text link instead. It goes on doing exactly what it
does today: one click, `setView("more")`, the code-swap page. Nothing about the code swap itself,
the room route, the protocol, the catalogue or any rule changes; the only thing that changes is how
much the page steers a player toward a route that asks them to move ~430-character codes between
two browsers by hand.

The reason the rank is wrong today: the code swap is the fallback for when the room route is not
usable — the route with no third party on the network path — and `README.md` and
`docs/multiplayer.md` both already describe it that way. The footer drew it as a peer of the two
primary actions anyway.

## Prior specs

- **Extends `2026-09-08-separate-multiplayer-connection-routes` (delivered); contradicts nothing
  in it.** That spec is what created this control and put it in this footer, and it is the spec
  whose own title is "…demote the code swap behind Other ways to connect". Its criteria pin the
  control's **DOM order and its effect** (`btn.otherWays` → `setView("more")`) and say nothing
  about its class, its weight or its size. This spec adds the visual half of the demotion that
  spec named and did not measure. The delivered `.lobbyfoot` order case is expected to pass
  **unedited** — the element stays a `<button>` in the same position.
- **Overlaps `2026-09-14-move-return-button-to-lobby` (delivered) in one line only, and that line
  is re-pinned rather than reversed.** Its Out of scope says "`Other ways to connect` on the host's
  room page, which calls `net.hangUp()` on the way… Untouched." That control — the one inside
  `.netescape`, built by `roomEscape` in `Lobby.tsx` — stays untouched here too. See Assumptions:
  it is the second and only other place `btn.otherWays` is drawn, and this spec deliberately does
  not restyle it.
- **Not already delivered.** `src/index.css` contains no link-style control class today. A search
  for `text-decoration` in that file returns one line, `.rules a{color:var(--gold)}`, which styles
  real anchors in the rules panel, and the three standalone button classes that exist — `.btn`,
  `.tinybtn`, `.kind` — are all boxed controls with a background and a border.

## Acceptance criteria

- [ ] **The chair table's Other ways control carries a link class and not `btn`.** In
      `src/components/screens/Lobby.tsx`'s final `return` (today line 699) the element is
      `<button className="linkbtn" onClick={() => setView("more")}>{t("btn.otherWays")}</button>`.
      A case in `src/test/render.test.tsx` reads the four `.lobbyfoot` buttons on
      `loadedState({ menu: "lobby" })` and asserts their `className` values are, in order,
      `"btn"`, `"btn ghost"`, `"linkbtn"`, `"btn ghost"` — so the de-emphasis is asserted **and**
      the three neighbours are asserted not to have moved.
- [ ] **The click still reaches the code swap, and still dispatches nothing.** The delivered
      _"reaches the code swap from the chair table without starting it"_ case passes unedited: the
      click leaves `.methods` on screen with `btn.swapHost` drawn, `dispatch` is not called and
      `net.start` is not called. No test's `press` / `labelled` helper is changed; both find
      buttons by `textContent` and are class-agnostic (`render.test.tsx` lines 1089–1093).
- [ ] **The footer is still four buttons, in the same order, in both locales.** The delivered
      _"offers four buttons on the chair table and names the route each takes"_ case passes
      **unedited**: four `<button>` elements in `.lobbyfoot` labelled `btn.openRoom`,
      `btn.joinGame`, `btn.otherWays`, `btn.back`. The control is not moved out of the footer, not
      moved within it, and not turned into an `<a>`.
- [ ] **One new CSS rule, and no existing one edited.** `src/index.css` gains `.linkbtn` (plus its
      `:hover`), declared once, with a comment above it saying **why** the control is drawn at less
      weight than its neighbours — that the code swap is the fallback route. The diff of
      `src/index.css` touches no other selector: `.btn`, `.btn.ghost`, `.btn.small`, `.btn.gold`,
      `.btn.blue`, `.tinybtn`, `.kind`, `.row`, `.lobbyfoot` and `.netescape` are byte-identical.
      The rule sits adjacent to either `.btn.small` (line 1123) or the `.lobbyfoot` block
      (lines 1020–1039), in the file's existing one-line-per-rule compact style — `src/index.css`
      is excluded from Prettier and is hand-formatted.
- [ ] **`.linkbtn` is a text link, stated as declarations rather than as an impression.** The rule
      declares `background:none` (or `transparent`), `border:0` (or `border:none`) and
      `box-shadow:none`; a `font-size` strictly smaller than `.btn.ghost`'s `14px`;
      `text-decoration:underline` unconditionally, not on `:hover` only, because a phone has no
      hover; `cursor:pointer`; and a `color` that is a hex already present elsewhere in
      `src/index.css` (e.g. the dek's `#A9BFB3`), so the palette gains no new entry. All of this is
      checkable by reading the rule.
- [ ] **The touch target does not shrink with the visual weight.** `.linkbtn` declares vertical
      padding of at least `8px`, so its hit box stays comparable to the `btn ghost` beside it in a
      sticky footer. Verified in the browser, not in jsdom: at **390x844** and at **1280x500** on
      `npm run dev`, with the lobby open, the element's `getBoundingClientRect().height` is **≥ 32**
      and `document.elementFromPoint` at the element's own centre returns the element (or a child of
      it), not `.lobbyfoot`. This is the reading `.railbtns` and `.lobbyfoot` each needed and jsdom
      cannot give.
- [ ] **No string, no key, no locale change.** `git diff --stat src/i18n/` is empty.
      `btn.otherWays` in `src/i18n/fi.ts` (line 591) and `src/i18n/en.ts` (line 599) are unchanged,
      no key is added, and `i18n.test.ts` passes unedited.
- [ ] **Nothing outside two components' worth of markup and one stylesheet rule moves.** No file
      under `src/game/` or `src/net/` appears in the diff; `GameState`, the `Action` union, `SCOPE`,
      `guestMay`, `hashState`, `NET_VERSION` (**6**) and `SAVE_VERSION` (**3**) are unchanged; no
      new component, no new prop on `Lobby` and no component-local state is added. `cx` is not
      needed: the class is a literal.
- [ ] **The `roomEscape` control is untouched.** `src/components/screens/Lobby.tsx` line 298 still
      reads `<button className="btn small ghost" onClick={toOtherWays}>`, and a render case asserts
      the `.netescape` button's `className` is exactly `"btn small ghost"` on a room host page, so a
      later reader cannot assume the two sites drifted apart by accident. See Assumptions for why
      this is a decision rather than an oversight.
- [ ] **Every gate passes**: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` (the permanent count rises by
      the cases added above and no existing case is deleted), `npm run build`.

**One criterion above is subjective and is named as such.** "Reads as a low-emphasis text link
rather than a competing button" cannot be asserted by a test; what a test can assert is the class,
the declarations and the hit box, which is what the criteria say. A reviewer judging the look should
open the lobby's first page at 1280x800 and at 390x844 in both locales and compare the three footer
controls side by side — **Open a room** (red `.btn`), **Join a game** and **Back** (green
`.btn ghost`), and the link — and ask whether the link still reads as clickable while no longer
reading as a fourth equal offer.

## Assumptions

Nobody answered a question during this run. Each of these was decided without asking.

- **The requirement's second named screen does not draw this control at all.** It names "the
  pre-room screen and the room-code entry/join screen". The join page (`view === "join"`,
  `Lobby.tsx` lines 604–655) draws exactly two buttons, `btn.joinRoom` and `btn.back`; Other ways
  was deliberately removed from it — "a second route beside the field is a second question asked
  before the first is answered" (`CLAUDE.md`) — and `render.test.tsx`'s _"holds the room and nothing
  else on the join page"_ case asserts in **both** locales that `btn.otherWays` is absent from that
  footer. **This spec does not put it back.** Restyling a control that is not drawn is nothing to
  do; the requirement's premise about that screen is stale, not a request for a second entry point.
- **The only other place `btn.otherWays` is drawn is `roomEscape`, and this spec leaves it alone.**
  `roomEscape` (`Lobby.tsx` lines 294–303, already `btn small ghost`) is rendered on three pages —
  the host's room page, the code-swap host page and a guest's or table's waiting page — inside an
  amber `.netescape` box under `lobby.roomTrouble`. Read literally, "on every screen where it
  currently appears" covers it. **It is excluded on purpose**, for three reasons: it is not beside
  any primary action, so it competes with nothing; it is already the smaller variant; and it is the
  **only** offered action on a page where the player is stuck in a room nobody has answered — which
  is precisely the "when the room route isn't usable" case the requirement itself names as the
  legitimate reason to reach for the code swap. De-emphasising the escape hatch would work against
  the requirement's own stated rationale. **If the reviewer disagrees, this is a one-word change**
  (`"btn small ghost"` → `"linkbtn"` at line 298) plus the criterion above that pins it.
- **The class is named `.linkbtn`** and the project has no prior art to copy: the existing
  standalone control classes (`.tinybtn`, `.kind`) are both boxed. The name, and the specific
  numbers — 13px, underline, a dek-coloured grey, ≥8px vertical padding — are this spec's choice,
  not a house style anyone wrote down. A different name or a `.btn.link` modifier of the existing
  `.btn` family would satisfy the requirement equally; `.btn.link` was rejected because it would
  have to unset five of `.btn`'s declarations to stop looking like a button.
- **It stays a `<button>`, not an `<a href>`.** It performs an action inside the app (component
  state), navigates nowhere, and an anchor would need a fake `href` to be focusable. Accessibility
  semantics are a known gap project-wide; this does not widen it, and the global
  `:focus-visible{outline:2px solid var(--gold)}` rule (line 32) still gives it a keyboard focus
  ring.
- **Position and order are unchanged.** The requirement asked for weight, not placement, so the link
  stays the third of the four footer controls rather than moving below the row or out of
  `.lobbyfoot`. Moving it would break the delivered order case, which is a signal this spec would
  rather not spend.
- **Keeping the hit target at ≥32px is an addition the requirement did not ask for.** A text link
  with a link's natural padding would be roughly 16px tall in a sticky footer a thumb reaches for;
  `.railbtns` and `.lobbyfoot` have each already cost this project a measurement over exactly that
  kind of mistake. The visual weight drops; the finger target does not.
- **No documentation is updated.** `README.md` (line 90) and `docs/multiplayer.md` (line 24)
  describe where the code swap lives, never how heavy its entry point is drawn, so neither becomes
  false. `Rules.tsx` says nothing about this control. `CLAUDE.md` is not touched either: no
  architectural boundary, invariant or protocol version moves.

## Touch points

- `src/components/screens/Lobby.tsx` — the final `return`'s `.lobbyfoot` (today lines 687–705): the
  `setView("more")` button at line 699 gets `className="linkbtn"`. Its comment block above (lines
  691–695) gains one sentence on why this one is drawn lighter than the two beside it. `roomEscape`
  (lines 294–303) is **read and left alone**.
- `src/index.css` — one new `.linkbtn` rule and its `:hover`, with a why-comment, adjacent to
  `.btn.small` (line 1123) or the `.lobbyfoot` block (lines 1020–1039).
- `src/test/render.test.tsx` — a new case asserting the four `.lobbyfoot` `className` values on the
  chair table, and a new assertion (or small case) pinning `.netescape`'s button as
  `"btn small ghost"`. The delivered _"offers four buttons on the chair table and names the route
  each takes"_ (line ~1418) and _"reaches the code swap from the chair table without starting it"_
  cases stay unedited.

## Out of scope

- **`roomEscape`'s button on the three room-waiting pages.** Named in Assumptions; it keeps
  `btn small ghost`, and `2026-09-14-move-return-button-to-lobby`'s Out of scope already said that
  control was untouched.
- **Putting Other ways to connect back on the join page.** It was removed deliberately; see
  Assumptions.
- **The code-swap route itself**: the `OtherWays` component, `LanSwitch`, `net/signal.ts`,
  `net/qr.ts`, `net/rtc.ts`, `net/room.ts` and every string on that page.
- **Any other control's styling**, `.btn.ghost` included. This is not a pass over the lobby's
  buttons; exactly one element changes class.
- **Moving, renaming or hiding the control**, and any conditional that would draw it on some pages
  and not others.
- **Accessibility work beyond keeping it a focusable `<button>`** — ARIA roles and labels stay the
  project-wide gap they are.
- **`README.md`'s "one level down on **both** sides" phrasing** (line 90), which is arguably stale
  now that the join page has no such link. Left for whoever owns that sentence.
- **Any tuppi rule, score, balance figure, `GameState` field, save or protocol version.**
