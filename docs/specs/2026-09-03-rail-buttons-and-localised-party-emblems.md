---
id: 2026-09-03-rail-buttons-and-localised-party-emblems
title: Keep the rail's buttons reachable and make the party emblem readable in English
kind: ui
status: proposed
---

# Keep the rail's buttons reachable and make the party emblem readable in English

## What

Two defects shipped with `2026-09-03-party-emblems-and-support` (commit `862313e`, PR #2) and are
on `main`. First, the thirteen-row `SupportBox` plate pushed the rail's **Rules** and **New game**
buttons off the bottom of a scrolling rail, so the player has to scroll the rail to reach them —
at an ordinary laptop window height as well as at 500 px. After this, both buttons are visible and
clickable at any window height with the rail unscrolled. Second, a card's party emblem is a
Finnish-derived initial (`KH` for _Kahvipuolue_) baked into `content.ts`, so an English player sees
`KH` on a card whose party is named _Coffee Party_: the code abbreviates a word that is never on
screen. After this, the emblem comes from the catalogue like every other player-facing string and
abbreviates the party name the player is actually reading.

Nothing about tuppi, scoring, support accrual or the party-to-card mapping changes.

## Acceptance criteria

- [ ] With the browser at 1280×800 **and** at 1280×500, with `.rail`'s `scrollTop` at 0 and a run
      loaded, both `.railbtns button` elements have a bounding rect fully inside the viewport
      (`top >= 0`, `bottom <= innerHeight`) and `document.elementFromPoint()` at each button's
      centre returns that button or a descendant of it. This is the defect: today the buttons sit
      below the fold at both heights.
- [ ] Nothing is permanently hidden behind the pinned footer: with `.rail` scrolled to
      `scrollHeight - clientHeight` at 1280×500, the last `.supportrow`'s rect bottom is `<=` the
      `.railbtns` rect top, and all 13 `.supportrow` elements are reachable by scrolling.
- [ ] `src/index.css` contains a `.railbtns` rule carrying `position:sticky` and `bottom:0` with an
      opaque background over the wood, and a comment saying why (the plate below `ConsumablesBox`
      is 13 fixed rows tall and the rail scrolls). The file stays hand-formatted and excluded from
      Prettier; `npx prettier --check` must not start covering it.
- [ ] At 800×600 — inside the existing `max-width:820px` media block, where the rail is a wrapping
      row — both rail buttons are still visible and clickable. No new media query is required, but
      the sticky rule must not break that layout.
- [ ] `Party` in `src/game/types.ts` is `{ id: string; key: string }`: the `g` field is gone, and
      `PARTIES` in `src/game/content.ts` no longer holds any emblem. A grep-style test asserts no
      `g:` remains on a `PARTIES` row.
- [ ] The emblem lives in both catalogues as `party.<id>.g`, reached through a new
      `emblemOfIn(locale, x)` in `src/i18n/index.ts` and `emblemOf` on the `I18n` context, matching
      the existing `.n` / `.t` accessors. `src/i18n/i18n.test.ts`'s "resolves every row in %s" case
      is extended to `.g`, so a party missing its emblem in either catalogue fails a test instead
      of printing `party.kahvi.g`.
- [ ] A test asserts, for **each** locale in `LOCALE_ORDER`: all 13 emblems match
      `/^[A-Z0-9]{1,2}$/` (the tofu law by construction), all 13 are distinct within that locale,
      and none case-insensitively equals an entry of the existing real-party blocklist in
      `i18n.test.ts` (SDP, KOK, PS, KESK, VIHR, VAS, RKP, KD, …). This replaces the
      `PARTIES`-shaped emblem case in `src/game/rules.test.ts`.
- [ ] A test asserts the emblem abbreviates the name the player sees, in each locale: for every
      party, the emblem's first character equals the first character of `nameOfIn(locale, p)`
      case-insensitively, and every character of the emblem occurs in that name. This is the
      criterion the defect fails today — `KH` against "Coffee Party".
- [ ] The Finnish emblems are unchanged: a test asserts `party.<id>.g` in `fi.ts` equals the
      thirteen current values (`KH SN MK PK HK TV SU HN LK NU LT KL SM`), so a Finnish player sees
      no change and the fix is additive.
- [ ] `src/components/PlayingCard.tsx`, `src/components/rail/SupportBox.tsx` and
      `src/components/screens/Rules.tsx` read the emblem through `emblemOf(p)` and no longer touch
      `p.g`. `src/test/render.test.tsx`'s "prints the party emblem on %s" and "shows every party in
      the rail, in the fixed PARTIES order" cases compare against the **locale's** emblem, and
      still assert against the `.pemblem` / `.pbadge` elements rather than card text.
- [ ] `README.md` says the emblem is localised (the section "Parties and support", and the
      sentence in Balance that mentions the emblem), and the test counts in `README.md` and
      `CLAUDE.md` are updated from 266 to the new number.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **This reverses one delivered criterion, deliberately.**
  `2026-09-03-party-emblems-and-support` required the emblem to be data in `content.ts`
  (`every 'g' … matching /^[A-Z0-9]{1,2}$/`) and assumed emblems were "in the spirit of the letter
  codes on a Finnish ballot". That reading loses: an initial derived from a translated name is
  player-facing text, so law 3 puts it in `src/i18n/`, and the earlier spec's own goal — an emblem
  that "carries information" — fails in English. The other data tables' `g` fields (`ENH`,
  `JOKERS`, `CONSUMABLES`, `VOUCHERS`) stay in `content.ts` and are **not** touched: those are
  language-neutral symbols (◼ ✦ ↕ ○), not abbreviations of a word.
- **The delivered spec's rail placement is kept, not reversed.** It already put `SupportBox` last
  "so it does not push every control in the rail down", and the defect shipped anyway, because the
  buttons sit _below_ the plate. Placement was necessary and not sufficient; the fix is to pin the
  footer, not to move the plate.
- **"Reachable without scrolling the rail" is read as a sticky footer**, not as making the plate
  collapsible or shorter. A collapsible plate adds an interaction and a catalogue string; a
  shorter plate contradicts the delivered 13-party split. Pinning `.railbtns` is the pattern this
  project already uses for `#declpanel`.
- **No nested scroll region is added inside the rail.** The support list keeps its natural height
  and the rail keeps being the one scroller, because a scrollbar inside a scrollbar is worse than
  a long rail. If the reviewer wanted the plate itself bounded, that is a separate change.
- **The requirement's second half slightly overstates the defect and the fix is aimed at the
  accurate part.** The emblem _can_ be matched to a name on screen today: both `SupportBox` and
  the rules panel print emblem and localised name in one row. What is true, and is what this fixes,
  is that the emblem abbreviates nothing the English player reads, so it is a lookup rather than a
  mnemonic and requires scrolling the rail or opening the rules to decode. No new legend is added,
  because two already exist.
- **"Readable to an English player" is made checkable as: first letter matches, every letter
  occurs in the name.** That is a test a machine can tick; "reads more clearly" is not. It does
  not guarantee a _good_ abbreviation, only an honest one — a reviewer should still read the 13
  English emblems in `en.ts` and judge them.
- **A feasible English set exists and was checked against every constraint above** (CF SA CB AU FW
  TA BG SD CL CA JU DW FG for coffee / sauna / cabin / anglers / firewood / tar / bog / snowdrift
  / cloudberry / campfire / jetty / deadwood / fog): 13 distinct, all `[A-Z]{2}`, none on the
  blocklist. The implementer is not bound to these exact strings, only to the constraints.
- **Emblems stay 1–2 characters.** The card corner and the 13-row rail plate were laid out for
  that width; a 3-character code would need CSS work in `.pemblem` and `.pbadge`.
- **The party-to-card mapping, support accrual, the 13×4 split and the seeded permutation are
  untouched.** `partyOf`, `g.partyMap`, `g.support` and `resolveTrick` keep their behaviour, so no
  balance figure moves and the balance stage is correctly not run for a `ui` kind.
- **Classified `ui`, not `i18n`.** The layout half is unambiguously `ui`, and only one kind is
  allowed. `ui` also runs the `playtest` stage that `i18n` does not, and both run `screen`, so this
  is the classification that runs more checks.
- **"An ordinary laptop window height" is read as 800 px** (1280×800), and the short case as the
  project's own 500 px. Both are asserted; heights between them follow from a sticky footer.
- **Mobile is still unverified.** The 800×600 criterion checks the wrapping-rail breakpoint in a
  desktop browser only. No phone is tested; that stays in the project's known gaps.

## Touch points

- `src/index.css` — `.railbtns` becomes a sticky footer (`position:sticky; bottom:0`, opaque
  background over the wood). Note the rail's own `padding-bottom:20px`: content scrolling through
  that gap below the footer needs the footer to cover it (negative bottom offset plus matching
  padding, or moving the padding onto the footer). Hand-formatted, Prettier-excluded.
- `src/game/types.ts` — `Party` loses `g`
- `src/game/content.ts` — `PARTIES` rows become `{id, key}`; `PARTY_IDS` unchanged
- `src/i18n/fi.ts` — 13 new `party.<id>.g` keys holding today's emblems, added first so `en.ts`
  fails to compile until it has them
- `src/i18n/en.ts` — 13 English emblems
- `src/i18n/index.ts` — `emblemOfIn(locale, x)` beside `nameOfIn` / `descOfIn`
- `src/i18n/localeContext.ts` — `emblemOf` on the `I18n` type
- `src/i18n/LocaleProvider.tsx` — `emblemOf` wired into the memoised value
- `src/components/PlayingCard.tsx` — `party.g` → `emblemOf(party)`; the emblem stays outside the
  `twin` gate on both branches
- `src/components/rail/SupportBox.tsx` — `.pbadge` reads `emblemOf(p)`
- `src/components/screens/Rules.tsx` — the parties table's first column reads `emblemOf(p)`
- `src/game/rules.test.ts` — the emblem-shape half of "has thirteen parties with distinct ids and
  ballot-style emblems" moves out; the id/`PARTY_IDS` half stays
- `src/i18n/i18n.test.ts` — `.g` added to the data-row case; per-locale shape, uniqueness,
  blocklist, abbreviates-the-name and Finnish-unchanged cases
- `src/test/render.test.tsx` — the two emblem cases compare against the locale's emblem
- `README.md`, `CLAUDE.md` — localised emblem noted; test counts updated

## Out of scope

- Changing which party a card belongs to, the 13×4 split, the seeded permutation, `partyOf`, or
  anything in `g.partyMap`.
- Changing how support accrues, what it is worth, or anything it might buy — it stays an inert
  counter, per `2026-09-03-party-emblems-and-support`.
- Renaming or rewriting the party names or descriptions in either catalogue, and adding a
  fourteenth party.
- Making the support plate collapsible, sortable, filterable, or internally scrollable.
- Moving `SupportBox` or any other plate to a different position in the rail.
- Giving `ENH`, `JOKERS`, `CONSUMABLES` or `VOUCHERS` glyphs the same treatment — those are
  language-neutral symbols.
- Accessibility semantics (ARIA) for the rail buttons, the emblem or the plate.
- Phone testing and any new responsive breakpoint.
- Retuning any balance figure or re-running the balance simulation; nothing scoring-related moves.

## Source

Not a rule or scoring change: no tuppi rule is read, reinterpreted or altered here. The Oulunsalo
senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>
describe suits, ranks, the näyttö, rami/nolo, ryöstö and sooli, and are silent on card markings and
on interface layout, so neither the emblem nor the rail footer can contradict them. The party
system remains Balatro-side content laid over an unchanged tuppi deck.
