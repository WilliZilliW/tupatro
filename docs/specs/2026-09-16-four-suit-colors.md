---
id: 2026-09-16-four-suit-colors
title: Draw each of the four suits in its own colour
kind: ui
status: proposed
---

# Draw each of the four suits in its own colour

## What

A card's face tells the player its suit by colour as well as by pip: ♠ stays black, ♥ stays red,
♦ becomes blue and ♣ becomes green. Today the deck has two colours and each of them covers two
suits, so colour narrows a card to a pair and the pip does the rest; after this, colour answers the
question on its own at a glance, in hand, on the felt, in the tuppipakka and in the shop's replace
picker.

Nothing about how tuppi is played changes. The declaration still groups ♥ and ♦ against ♠ and ♣ —
what changes is that the game must stop calling that grouping "red" and "black", because with a
blue diamond on the felt that sentence is false. Six catalogue strings and one README bullet name
the two suits instead.

## Acceptance criteria

- [ ] `src/index.css`'s `:root` declares exactly four suit tokens — `--suit-s:#20302A`,
      `--suit-h:#C0392B`, `--suit-d:#17569C`, `--suit-c:#15683B` — and four rules
      `.card.s-S` `.card.s-H` `.card.s-D` `.card.s-C` each set `color` to the matching token.
      `.card.red` (line 501 today) and the now-unused `--red` token are gone; `--black` stays,
      it has three other call sites.
- [ ] `src/components/PlayingCard.tsx` puts `"s-" + card.s` on the card root in place of
      `m.red && "red"` (line 68), matching the existing `"e-" + card.enh` convention. The stone
      branch above it gains no suit class: a stone card plays with no suit, and its tuppipakka
      twin stays muted exactly as it is today.
- [ ] A case in `src/test/render.test.tsx`'s `PlayingCard` block (beside "prints the party emblem
      on %s", ~line 1040) renders one ordinary card of each suit and asserts four **distinct**
      suit classes on the root, and that `.card.red` is nowhere in the tree. A case for a stone
      card asserts it carries none of the four.
- [ ] A case in `src/test/invariants.test.ts` reuses the existing `src/index.css` parse (the
      `rules` array at ~line 330) to assert that the four `.card.s-*` rules exist and that the
      four colour values they resolve to are **four distinct strings** — so a palette that pairs
      two suits back together fails here rather than in the browser.
- [ ] The pure core is untouched: `SM` in `src/game/constants.ts` still carries `red:true` for
      `H`/`D` and `red:false` for `S`/`C`, `SUITS` and `HAND_SUITS` are byte-identical, and
      `game/state.test.ts`'s alternation case, `game/seats.test.ts`'s pinned literals and every
      `punainen` case in `game/scoring.test.ts` pass unchanged with no edit. `red` is a **rule**
      field — `showCardFor` in `reducer.ts` (~line 206) and `chipValue` in `cards.ts` (~line 76)
      read it — and deleting it is not part of this.
- [ ] No catalogue string describes the näyttö by colour any more. `declare.fine`,
      `btn.showRami`, `btn.showNolo`, `table.declNote`, `table.noloNote` and the näyttö item of
      `rules.tuppi` name the suits instead, in **both** `fi.ts` and `en.ts`.
- [ ] A case in `src/i18n/i18n.test.ts`, modelled on "keeps the retired invitation vocabulary out
      of both catalogues" (~line 92), asserts that none of those six values matches
      `/punain|musta|\bred\b|\bblack\b/i` in either locale. **The word boundary is load-bearing**:
      a naked `red` matches "decla**red**", and a test that has to be weakened later is worse than
      one written right. The scan is those six keys only — `boss.punainen.n` keeps its name (see
      Assumptions).
- [ ] The two declaration buttons read `"♥ ♦ — RAMI"` and `"♠ ♣ — NOLO"`, the same string in both
      catalogues. `.btn` sets `font-family:var(--font-d)` (Alfa Slab One), which has no suit
      glyphs, so the browser falls back per character — check the four glyphs render rather than
      tofu at 1280×800 and 390×844, and if they do not, use the suit words in each language
      instead and keep the button row on one line at 390 px.
- [ ] `README.md`'s näyttö bullet (~line 216) no longer says "A red card means _rami_, a black
      card means _nolo_": it names the suits, and one sentence beside it says the deck is drawn in
      four colours, one per suit. `grep -n "A red card means" README.md` finds nothing.
- [ ] The three comments this makes false are corrected: `constants.ts`'s `HAND_SUITS` comment
      ("♠ ♥ ♣ ♦, black red black red"), `src/components/cx.ts`'s doc example
      (`cx("card", red && "red")`), and CLAUDE.md's "a hand reads better when the colours
      alternate" sentence under **There are two suit orders**. The order itself does not move.
- [ ] Contrast, computed against every background a suit glyph is drawn on — the plain face's
      three gradient stops (`#FBF7EC` `#F5EFE2` `#E8DFCB`) and the darkest stop of each of the six
      enhancement faces (`#B7CFE8` `#E5B5A9` `#C9B4E6` `#AEB8C0` `#A8DBD8` `#DFC470`): ♠ ≥ 6.86:1,
      ♦ ≥ 3.66:1, ♣ ≥ 3.39:1. ♥ is unchanged at ≥ 2.70:1 (the steel face), which is pre-existing
      and deliberately not moved. Any deviation from the pinned hexes must recompute this table
      and put the new figures in the pull request.
- [ ] `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` all pass, and no existing test is deleted or weakened.
      Mutation check: replacing `"s-" + card.s` with a constant `"s-H"` must fail the render case,
      and pointing `--suit-c` at `--suit-s` must fail the invariants case.

**Not checkable by a test, so a reviewer looks at it instead.** In a deal at 1280×800 and at
390×844, in both languages: a hand holding one card of each suit reads as four colours and not two;
a ♦ and a ♣ on the felt read as blue and green rather than as black at the 33 px pip and the 12 px
corner pip; the same two suits on an `e-steel`, `e-wild` and `e-gold` face are still legible; and
the 42 px `.card.mini` in the rail's tuppipakka and the shop's replace picker is still readable.
Whether the palette is _attractive_ is nobody's test — this is the list to look at.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **♠ black, ♥ red, ♦ blue, ♣ green**, which is the standard four-colour poker deck and the
  mapping a player is most likely to have met before. Two of the four colours therefore keep their
  exact current values (`--black` `#20302A` and `--red` `#C0392B` move into `--suit-s` and
  `--suit-h` unchanged), so only two colours in the game are new and half the deck cannot regress.
- **A warm colour for ♦ was considered and rejected.** Making ♦ orange and ♣ a cool dark would have
  kept the rami pair reading as "warm" and the nolo pair as "cool", which would have preserved the
  source's own red/black sense of the näyttö. GitHub issue #1 names "siniset ja vihreät" — blue and
  green — so the issue's own words win over that reconciliation, and the text change below is what
  pays for it.
- **The exact hexes were computed, not picked by eye**, against every card-face background in
  `index.css`. `#17569C` and `#15683B` are the point where contrast against the six enhancement
  faces (≥ 3.4:1) stops fighting separation from the near-black ♠ (2.0:1 and 1.9:1 luminance ratio).
  Brighter variants separate better from ♠ and fall under 3:1 on the steel face; darker ones do the
  reverse.
- **Colour-blindness: the new pairing is imperfect and this spec does not add a second cue.** Under
  a simulated deuteranopia the four render as ♠ `#2C2C2A`, ♥ `#77771E`, ♦ `#4A4A9C`, ♣ `#59593D` —
  ♦ stays clearly apart, and ♥/♣ are the weak pair at a luminance ratio of 1.52 (protanopia is
  worse, 1.20). That is the known red/green limit and it is the reason colour here is a **redundant**
  cue: the pip shape and the rank are unchanged and remain the card's identity. No outlined pip, no
  rank badge and no colour-blind palette toggle is added.
- **The sources state the declaration in colours, and this departs from their vocabulary while
  leaving the rule alone.** korttipeliopas.fi: "Ramia näytetään punaisella kortilla ja noloa
  mustalla"; the Oulunsalo club sheet groups it the same way. The grouping is untouched — ♥ and ♦
  still declare rami, ♠ and ♣ still declare nolo, `showCardFor` is not edited — but with a blue ♦ on
  the felt the sentence "show a red card" can no longer be acted on, so the game says "hearts or
  diamonds" where the source says "red". This is a wording departure, recorded rather than hidden,
  and it is why the six-string criterion is not optional polish.
- **The `punainen` boss keeps its name and its description.** "Punainen kielto" / "Red Ban" is a
  proper name, and `boss.punainen.t` already spells out "Hertat ja ruudut" / "Hearts and diamonds",
  so the row still tells the truth about what it does. A player may still wonder why a blue diamond
  is banned by something called Red; accepted, and the description is the answer. The i18n scan is
  scoped to the six declaration strings for exactly this reason.
- **Nothing on a dark surface is tinted.** Every suit glyph this spec colours sits on the light
  paper card face. The shop item's `cardLabel`, the `{card}` in toasts, the ♥/♠/♦ emblems on the
  joker and challenge rows and the `ModeBox` note all inherit their surface's colour today and keep
  it — a saturated blue or green on the dark panel would need a second, lighter palette, which is a
  bigger change than the one asked for.
- **A stone card stays uncoloured**, root and tuppipakka twin alike. Its face already hides suit and
  rank because it has neither in play; the twin is deliberately muted, and colouring it would make
  it read as a card that could follow suit.
- **`HAND_SUITS` keeps its order** (`S H C D`) even though its stated reason — two red suits never
  side by side — is weaker once every neighbour differs in colour. Reordering it would move
  `game/state.test.ts` and, through `bot.ts`'s positional picks, the 50-seed aggregate, for a
  layout preference. The comment is corrected; the array is not.
- **`--red` is deleted rather than repointed.** It has exactly one call site today (`.card.red`),
  which this removes; `--black` has three others and stays.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/index.css` — `:root` gains the four suit tokens and loses `--red`; the single
  `.card.red{color:var(--red)}` rule becomes four `.card.s-*` rules in the same `/* cards */` block.
- `src/components/PlayingCard.tsx` — the `cx(...)` call on the card root (line 68). `const m =
SM[card.s]` stays, the glyph still comes from it.
- `src/components/cx.ts` — the doc comment's `red && "red"` example.
- `src/game/constants.ts` — the `HAND_SUITS` comment only. `SM` and both arrays are untouched.
- `src/i18n/fi.ts` — `declare.fine`, `btn.showRami`, `btn.showNolo`, `table.declNote`,
  `table.noloNote`, and the näyttö item of the `rules.tuppi` list.
- `src/i18n/en.ts` — the same six. `en.ts` is typed off `fi.ts`, so no key is added or removed here.
- `src/i18n/i18n.test.ts` — the colour-vocabulary case, beside "keeps the retired invitation
  vocabulary out of both catalogues".
- `src/test/render.test.tsx` — the suit-class cases in the `PlayingCard` block; `table.noloNote` is
  already referenced at ~line 5916 through `translate()`, so that case needs no edit.
- `src/test/invariants.test.ts` — the CSS case, over the `rules` array already parsed from
  `src/index.css`.
- `README.md` — the näyttö bullet in the rules list (~line 216) plus one sentence on the deck's four
  colours.
- `CLAUDE.md` — the "colours alternate" sentence under **There are two suit orders, and only one of
  them may touch the engine**.

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- Any rule or scoring change. `SUITS`, `HAND_SUITS`, `SM[s].red`, `showCardFor`'s red/black test,
  the `punainen` and `patakielto` bosses, `legalCards`, `currentWinner` and `evalTrick` are all
  untouched, and no pinned literal in `game/seats.test.ts` may move.
- Colouring a suit glyph anywhere but a card face: the shop's card label, toast card labels, the
  rail plates, `ModeBox`, and the `♥`/`♠`/`♦`/`♣` emblems on `JOKERS` and `CHALLENGES` rows all keep
  the colour they inherit.
- A setting, voucher or lobby option that switches between the two-colour and four-colour decks.
  There is one deck and it has four colours.
- A second redundant cue for colour vision deficiency — outlined pips, a duplicated rank corner, or
  a high-contrast palette toggle. Named in Assumptions as the known limit; it needs its own spec.
- Renaming the `punainen` boss or rewriting `boss.punainen.t`.
- The felt, the rail, the card back, the enhancement face gradients and the party emblem's colour.
- The localised suit names `suit.*` and `suitPart.*`, which name suits and never colours already.
- `2026-09-03-party-emblems-and-support.md` owns the rest of the card face (the emblem in the
  bottom-left corner); this spec touches neither its position nor its colour.
