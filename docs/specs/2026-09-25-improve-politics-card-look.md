---
id: 2026-09-25-improve-politics-card-look
title: Redraw Politiikka's spade and heart marks, and size all four suit icons with the card
kind: ui
status: proposed
---

# Redraw Politiikka's spade and heart marks, and size all four suit icons with the card

## What

In a Politiikka deal the clubs and diamonds already carry a party flower as their centre pip, but
the other two suits lag behind. Spades still draw the plain `♠` with a 6.5 px "PS" roundel squeezed
into a corner. Hearts draw a bare two-stroke V. After this change spades draw a **dandelion
(voikukka)** and hearts a **bird in flight whose wings form a V**. Both are flat, original SVG
shapes in the same style as the clover and the cornflower. The ♠Q caricature gets as much detail
as the ♦K one. All four suit icons also shrink with the card at the narrow breakpoints, where the
text glyph they replaced already shrank.

Requirement, verbatim: _"Politiikkakorttien ulkoasua pitäisi parantaa, varsinkin perussuomalaisiin
ja vasemmistoliittoon panosta."_ ("The look of the politics cards should be improved, especially
Perussuomalaiset and Vasemmistoliitto.")

## Acceptance criteria

- [ ] In `src/components/PlayingCard.tsx`, a new component `SpadeDandelion` draws Politiikka's
      ordinary spades. With `challenge: "politiikka"`, rendering `card("S", 5)` gives a
      `.card .big` that contains an `<svg>` and whose `textContent` is `""`. The plain `♠` centre
      glyph is gone from that mode. The top-left `.sm` corner still prints `SM.S.g`, as on every
      other suit.
- [ ] `SpadeDandelion` draws a dandelion head of **at least 16** narrow ray florets fanned around
      a centre (`Array.map`, the same way `DiamondCornflower` fans its nine petals), plus a stem
      and a leaf with at least three teeth along one edge. Both counts can be read off the source.
      The floret count is what keeps it from reading as the cornflower.
- [ ] `HeartRose` is replaced by a component named `HeartBird`. It draws a bird in flight: two
      wings that together make a V, plus a separate body/head shape where they meet. With
      `challenge: "politiikka"`, `card("H", 5)` gives a `.card .big` containing an `<svg>` whose
      `textContent` is `""`. `grep -n "HeartRose" src/` finds nothing.
- [ ] `SpadeDandelion` and `HeartBird` use `currentColor` only. Their rendered SVG markup contains
      no `#` colour literal and no `<text>` element, which a render test asserts. The spade icon
      therefore draws in `--suit-s` and the bird in `--suit-h`, exactly as the text glyph did, and
      no letter depends on a font.
- [ ] The `.psbadge` corner mark is removed. With `challenge: "politiikka"`, no card (`card("S", 5)`,
      `card("S", 12)`, or any other) renders a `.psbadge` element. `grep -rn "psbadge" src/` finds
      nothing, and the `.card .psbadge` and `.card.mini .psbadge` rules are gone from
      `src/index.css`.
- [ ] None of `ClubClover`, `DiamondCornflower`, `HeartBird` or `SpadeDandelion` carries an
      absolute pixel `width`/`height`. The rendered `<svg>` either has no `width` attribute or one
      ending in `em`, and a render test asserts this for all four. Each is sized in `em`
      (attribute or a `.card .big svg` rule). At the default `.big` font-size of 33 px the clover
      and cornflower keep their current size to within 1 px: 30 px is about `0.91em`, 28 px about
      `0.85em`.
- [ ] `ClubClover`'s and `DiamondCornflower`'s shapes are unchanged: their `<circle>`/`<rect>`/
      `<path>` geometry and `transform`s are byte-identical apart from the sizing attributes.
- [ ] `PsLeader` (the ♠Q caricature) is redrawn with **at least 10** shape elements, which is
      `KokoomusLeader`'s own count. It stays an inline SVG in the 40 px `.portrait` frame: no
      `<img>`, no `<image>` and no new file under `src/assets/`. The existing test "draws the King
      of Diamonds and Queen of Spades as caricatures" still passes. The ♠Q case asserts
      `.portrait svg` and no `.psbadge`.
- [ ] In every other mode (`null`, `"tuppi"`, `"race"`, `"nami"`, `"rummikub"`, `"rps"`), ♣5, ♥5,
      ♦5, ♠5, ♦K and ♠Q still draw the plain `SM[s].g` text glyph with no `<svg>` in `.big` and no
      `.psbadge`. The existing "every other mode" cases in `src/test/render.test.tsx` keep asserting
      this.
- [ ] The three unconditional portraits (♣K, ♣Q, ♥Q/Sofia) are still drawn ahead of the suit-icon
      branches, and in Politiikka `card("H", 12)` renders `.portrait` and no `.big svg`. The
      `--suit-*` custom properties, `.card.trad` and the `trad` expression are untouched.
- [ ] `render.test.tsx`'s `describe("Politiikka's four suit icons")` and the comment above it
      describe the new state: the spade draws an SVG and no card draws a badge. `README.md`'s
      Politiikka paragraph and `CLAUDE.md`'s Politiikka suit-icon bullet name the dandelion and the
      bird in place of "a bold sharp V", the plain spade pip and the "PS" corner mark.
- [ ] How good it looks is subjective, and no test can decide it. In a Politiikka deal at
      **1280x800**, **1280x500** and **390x844**, the reviewer should check: - the dandelion is recognisable and does not read as the cornflower; - the bird reads as a bird and still as a V; - neither icon collides with the `.r`/`.sm` corner, `.pemblem` or `.chip`; - at 390x844 all four icons stay inside the 44x62 card; - the ♠Q caricature holds up next to the ♦K.

## Assumptions

- **"Politiikkakortit" means Politiikka's suit-icon layer and its two caricatures in
  `PlayingCard.tsx`, not the fictional `PARTIES` emblems or `GovBox`.** Those are what visibly
  stand for Perussuomalaiset (spades) and Vasemmistoliitto (hearts). The fictional party emblem in
  each card's bottom-left corner and the gold government highlight are left alone.
- **Perussuomalaiset becomes a dandelion because that is the party's own current symbol.** Its
  visual identity published on 10 April 2026 centres on the voikukka
  (<https://www.perussuomalaiset.fi/ajankohtaista/perussuomalaisten-uusi-visuaalinen-ilme-ja-logo-on-julkaistu/>).
  A flower also puts spades in the same family as Keskusta's clover and Kokoomus's cornflower.
- **Vasemmistoliitto becomes a bird in flight shaped like a V because that is the party's own
  mark** (a red bird resembling the letter V, <https://vasemmisto.fi/vasemmistoliitto-uudisti-visuaalisen-ilmeensa/>).
  This keeps the V the heart already carried and gives it a subject.
- **Both are drawn from scratch and are not a trace of either party's logo.** The project already
  drew this line: `CLAUDE.md` records that a request to recreate the real registered logos was
  refused. The shapes evoke each party's symbol; they do not reproduce it. A reviewer who finds
  either too close to the real mark should push it further from it.
- **This reverses a hand-made, unspecced decision: "spades keep the plain ♠ glyph even in this
  mode, and carry PS as a corner badge."** That choice was made in commits `82b6c09` and `b760efd`
  (24 September) and is written up in `CLAUDE.md` and `README.md`, with the reason that "the
  ordinary spade is never mistaken for a card the game reads differently." That reason does not
  hold up: clubs, hearts and diamonds are all redrawn in the same mode and nothing is misread.
  Meanwhile the badge is the weakest part of the PS look, illegible at 6.5 px and overlapping the
  card on the 44 px breakpoints. **The corner badge and its "PS" letters are removed outright**, so
  spades match the other three suits. Putting a legible badge back is a small follow-up if the
  letters are missed.
- **This also partly reverses the Sep 24 commit `d643fa7` → `82b6c09` sequence that dropped a lion
  crest for spades.** A dandelion is not a lion. The party itself moved from the lion to the
  dandelion, and a flower matches the other suits.
- **Both new icons inherit the suit colour (`currentColor`) rather than using party colours** (a
  yellow dandelion, a pinker red bird). The four-suit colour system
  (`docs/specs/2026-09-16-four-suit-colors.md`) makes the suit, not the party, decide a card's
  colour, and the clover and cornflower already follow that. The two caricatures keep hardcoded
  skin, hair and clothing colours, as they do now.
- **Clubs and diamonds count as "the politics cards" only for sizing.** Their shapes are not
  redesigned: the user singled out the other two, and both were reworked by hand yesterday. The
  `em` sizing applies to all four because a fixed 30 px icon inside a 44x62 card is the same defect
  on every suit.
- **The ♠Q caricature is in scope and nothing else about the leaders is.** It is a
  Perussuomalaiset card and is visibly sparser than the ♦K (6 shapes against 10). No new
  caricature is added, including for Vasemmistoliitto's or Keskusta's leaders: that would put a
  new real person's likeness on the public site, which is a decision for the human, not an
  inference from "invest in".
- **The real-party suit layer does not conflict with `i18n.test.ts`'s "no invented party is a real
  one" test.** That test covers the fictional `PARTIES` catalogue only. After this change the suit
  layer carries no text at all (the "PS" string goes with the badge), so it touches no catalogue.
- **This is `ui`, not `rule`.** No card's suit, rank, party, legality, trick winner or value
  changes. Only the SVG drawn in `.big`/`.portrait` and one CSS rule change.

## Touch points

- `src/components/PlayingCard.tsx`:
  - Add `SpadeDandelion` and a `card.s === "S"` branch for it in the Politiikka section of the
    ternary. It goes after the `♠Q`/`PsLeader` branch, so the caricature still wins for the queen.
  - Replace `HeartRose` with `HeartBird`.
  - Redraw `PsLeader`.
  - Delete the `.psbadge` span and its comment.
  - Switch the four suit-icon SVGs to `em` sizing.
  - Rewrite the block comment above `ClubClover`, which currently explains the plain spade and the
    badge.
- `src/index.css`:
  - Delete the `.card .psbadge` and `.card.mini .psbadge` rules and their comment.
  - Add a `.card .big svg` sizing rule if the `em` sizing is done in CSS rather than as attributes.
- `src/test/render.test.tsx`: update `describe("Politiikka's four suit icons")`, including the
  comment above it, the spade case, the ♠Q badge case and the every-other-mode `.psbadge` null
  checks. Add the no-`#`/no-`<text>` assertion and the `em`-width assertion.
- `README.md`: the Politiikka paragraph around "Three of the four suits' own big centre pip…" and
  "Spades keep the ordinary ♠ pip even here".
- `CLAUDE.md`: the Politiikka bullets "Three suits' own big centre glyph becomes a stylised icon…"
  and "Two more honours exist…".

## Out of scope

- The fictional `PARTIES` list, their catalogue names and emblems, `.pemblem`/`.govparty`, and
  `GovBox`. The party-emblem work is `docs/specs/2026-09-03-party-emblems-and-support.md`, and the
  government is `docs/specs/2026-09-20-combine-politics-modes.md`.
- Redesigning `ClubClover` or `DiamondCornflower` beyond their sizing, and `KokoomusLeader`.
- New caricatures for any other rank or party, and any photograph or traced logo.
- Changing any `--suit-*` colour, the traditional two-colour deck (`.trad`), or the suit icons in
  any mode other than Politiikka.
- Sofia's portrait, her `.sofia` letter badge, and her rampage and explosion animations
  (`docs/specs/2026-09-25-sofia-rampage-and-explosion.md`,
  `docs/specs/2026-09-25-sofia-explosion-screen-shake.md`).
- Any rule, scoring or balance change in Politiikka.

## Source

Not a rule or scoring change. The party symbolism the two new icons draw on is cited under
Assumptions.
