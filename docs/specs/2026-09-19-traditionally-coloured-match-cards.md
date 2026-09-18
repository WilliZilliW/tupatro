---
id: 2026-09-19-traditionally-coloured-match-cards
title: Deal Traditional Tuppi and the Tuppi Race from a two-colour deck
kind: ui
status: proposed
---

# Deal Traditional Tuppi and the Tuppi Race from a two-colour deck

## What

In **Traditional Tuppi** (`challenge === "tuppi"`) and the **Tuppi Race** (`challenge === "race"`)
a card is drawn in the colour a physical tuppi deck would give it: ♥ and ♦ red, ♠ and ♣ black.
Everywhere else — the roguelike run, Tupatro, Nami, Nami Hard, Rock-Paper-Scissors and
Tuppi-Rummikub — the four-colour deck delivered by `2026-09-16-four-suit-colors` is unchanged, so
♦ stays blue and ♣ stays green there.

Nothing about how tuppi is played changes, in any mode: the declaration still groups ♥ and ♦
against ♠ and ♣, `SM[s].red` is untouched, and no catalogue string is added or edited. The deck's
colour follows the mode the player is already in; there is no setting, no toggle and no new field
on `GameState`.

## Prior specs this touches

- **Contradicts one clause of [`2026-09-16-four-suit-colors`](2026-09-16-four-suit-colors.md)
  (delivered, `ui`), and this reading wins.** Its Out of scope says: "A setting, voucher or lobby
  option that switches between the two-colour and four-colour decks. There is one deck and it has
  four colours." The second sentence is reversed here — there are two decks now and the mode picks
  one. **The first sentence still stands**: the switch is not a setting, a voucher or a lobby
  option, and no player-facing control chooses a deck. That is a reversal a reviewer must see, so
  it is stated here rather than implied; the earlier spec's own file is left as it is, since
  everything else in it — the four tokens, the `s-*` classes, the six de-coloured strings, the
  `SM.red` boundary — is still the delivered behaviour and is still what the other seven modes draw.
- **Overlaps nothing else.** `2026-09-18-king-of-clubs-ikiliikkuja` says clubs keeps its colour and
  its portrait; a traditional ♣ King is drawn black and keeps its portrait, and that spec's own
  criteria are unaffected.
- **Not already delivered.** `PlayingCard.tsx` line 71 puts `"s-" + card.s` on every card root in
  every mode today, and `src/index.css` lines 508–511 give those four classes four distinct colours
  with no mode in the selector.

## Acceptance criteria

- [ ] `src/components/PlayingCard.tsx` adds a `"trad"` class to the card root — in the same
      `cx("card", …)` call at line 71, beside the existing `"s-" + card.s`, which is **not**
      removed or replaced — exactly when `g.challenge === "tuppi" || g.challenge === "race"`. The
      two ids are spelled out (no bare `g.challenge` truthiness test, no helper that puts
      `g.challenge` in front of a `)` or a `?`), and a comment says why Tupatro is not in the list.
      The `isStone` early return above it is untouched.
- [ ] `src/index.css` gains exactly two rules, in the `/* cards */` block immediately after
      `.card.s-C` (line 511): `.card.trad.s-D{color:var(--suit-h)}` and
      `.card.trad.s-C{color:var(--suit-s)}`. **No new colour token is declared** — a traditional ♦
      is the same hex `#C0392B` as ♥ and a traditional ♣ the same `#20302A` as ♠ — so the
      traditional deck can hold exactly two colours and never a third.
- [ ] Cases in `src/test/render.test.tsx`'s `PlayingCard` block (beside "gives each suit its own
      class, distinct from the others", ~line 1144) render one card of each suit in
      `loadedState({ challenge: "tuppi" })` and in `loadedState({ challenge: "race" })` and assert
      every root carries `trad` **and** still carries its own distinct `s-*` class.
- [ ] A companion case asserts no root carries `trad` for the other seven states: `challenge: null`
      and `"tupatro"`, `"nami"`, `"namihard"`, `"rps"`, `"rummikub"`. The seven are **spelled out in
      the test**, not derived from the component's own predicate, so a test cannot pass by agreeing
      with a mistake. (`ChallengeId` is in `src/game/types.ts` line 143.)
- [ ] A case in `src/test/invariants.test.ts`, beside "gives each of the four suits a distinct
      colour" (~line 373) and reusing the same parsed `rules` array, asserts that
      `.card.trad.s-D` and `.card.trad.s-C` both exist, that each sets `color` from a variable
      declared in `:root`, and that the four colours a traditional deck resolves to (♠, ♥, trad ♦,
      trad ♣) are exactly **two** distinct strings — trad ♦ equal to ♥'s value and trad ♣ equal to
      ♠'s. A palette that gives the traditional deck a third colour fails here rather than in the
      browser.
- [ ] The three delivered four-colour cases pass **unedited**: render's "gives each suit its own
      class, distinct from the others" and "gives a stone card none of the four suit classes", and
      invariants' "gives each of the four suits a distinct colour". `loadedState()` with no
      override is a main-game state, and neither the four tokens nor the four `.card.s-*` rules
      move.
- [ ] Nothing under `src/game/` changes: `git diff --name-only main` names no file in that
      directory. `SM`, `SUITS`, `HAND_SUITS`, `showCardFor` and `chipValue` are byte-identical, and
      every pinned literal in `game/seats.test.ts` is unmoved.
- [ ] No catalogue key is added, removed or edited: `git diff --name-only main` names neither
      `src/i18n/fi.ts` nor `src/i18n/en.ts`. `btn.showRami` and `btn.showNolo` still read
      `"♥ ♦ — RAMI"` and `"♠ ♣ — NOLO"` in both locales, in every mode.
- [ ] Nothing in `GameState`, the save or the wire moves: `SAVE_VERSION` stays `3`, `NET_VERSION`
      is unchanged, and `SCOPE`, `hashState`, `parseMsg` and `guestMay` gain no member. The deck is
      read from `g.challenge`, which every peer and every snapshot already carries.
- [ ] `README.md`'s näyttö bullet (~line 219) stops stating the four-colour deck unconditionally:
      it says the deck is drawn in four colours, one per suit, **except** in Traditional Tuppi and
      the Tuppi Race, which are dealt in the traditional two. Both modes are named in the
      sentence that replaces it, and `grep -n "traditional two-colour pairing" README.md` finds
      nothing — the old clause is rewritten, not appended to.
- [ ] `CLAUDE.md`'s **There are two suit orders** section (line ~852) gains one clause saying the
      same thing, so the next reader of `HAND_SUITS` knows that in those two modes its alternation
      is again literally red/black. The arrays themselves do not move.
- [ ] `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` all pass, and no existing test is deleted or weakened.
      **Mutation check:** narrowing the predicate to `g.challenge === "tuppi"` alone must fail the
      race render case, and pointing `.card.trad.s-C` at `var(--suit-c)` must fail the invariants
      case.

**Not checkable by a test, so a reviewer looks at these instead.** In a Traditional Tuppi deal and
a Tuppi Race deal, at 1280×800 and 390×844, in both languages: the hand and the felt read as two
colours, with ♦ red and ♣ black at both the 33 px pip and the 12 px corner pip; the sooli exchange
panel's two `.card.mini` follow the same deck; the ♣ King's and ♣ Queen's portrait cards read black
in the corner. Then a Tupatro deal in the same session still reads as four colours, and so does a
roguelike deal. Whether the traditional deck is _nicer_ is nobody's test — that list is what to
look at.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Traditionally coloured" is read as the two-colour pairing of a physical deck: ♥ ♦ red, ♠ ♣
  black** — and specifically as the exact two colours this game drew before `2026-09-16-four-suit-colors`,
  `--suit-h` `#C0392B` and `--suit-s` `#20302A`. No new hex is introduced, so half the deck is
  pixel-identical to today in every mode and the other half is pixel-identical to the game as it
  shipped before September 16.
- **Exactly the two modes named get it, and a future mode defaults to four colours.** Tupatro is
  Traditional Tuppi's twin — the same deal, the same point table, the same 52 — and Nami, Nami Hard
  and Rock-Paper-Scissors are tuppi-shaped in places too, but the requirement named two modes and
  this spec seats two. Tupatro's exclusion is the sharpest guess here: it is the mode most likely to
  have been meant and not said. The comment required on the predicate is what records that choice at
  the line that makes it, so extending the list later is one array element.
- **The roguelike run keeps four colours on purpose.** There a card's suit is a scoring question —
  the `punainen` and `patakielto` bosses, the party map, the sharpener — and colour answering the
  suit at a glance is what that spec bought. The match modes have no bosses, no jokers and no
  vouchers, so the fast read is worth less there than the familiar deck.
- **No catalogue string becomes mode-conditional.** In these two modes the sources' own sentence
  ("Ramia näytetään punaisella kortilla ja noloa mustalla") is again literally true on screen, but
  the six declaration strings name **suits**, which is true in every mode, and making them branch on
  the mode would mean six new keys in both locales to say the same rule twice. They stay as
  `2026-09-16-four-suit-colors` left them.
- **No rules-panel line explains the two decks.** It would need new keys in both catalogues, and a
  player who has seen a physical deck does not need telling that ♦ is red. Recorded as a gap, not
  hidden: the README and CLAUDE.md are where it is written down.
- **No new contrast question is raised, so none is computed.** A traditional ♦ is drawn in the exact
  colour ♥ is already drawn in on the same faces, and these two modes carry none of the roguelike
  shell — no enhancements, so no `e-steel`/`e-gold` face ever appears in them and the background is
  always the plain paper gradient, where red measures ≈4.1:1 against its darkest stop
  (`#E8DFCB`) exactly as ♥ does today.
- **Colour vision deficiency: the traditional deck is strictly worse than the four-colour one, and
  that is accepted for these two modes.** Red/black under deuteranopia or protanopia is the
  classic weak pair, and this is the state every physical deck is in; colour stays a **redundant**
  cue because the pip shape and the rank are unchanged. No second cue, no outlined pip and no
  palette toggle is added — that stays where `2026-09-16-four-suit-colors` left it, needing its own
  spec.
- **The deck follows the game, never the window.** `g.challenge` is on `GameState` and is already
  in `hashState`, so every peer, the shared table and a `PrivateTable` window all draw the same
  deck. A colour resolved from the viewer instead would be `myEcon` coming back in a new shape.
- **The class is named `trad`**, following the existing `s-*` / `e-*` / `mini` / `twin` convention
  on the card root, and the predicate lives in `PlayingCard.tsx` rather than in `src/game/`. Which
  colours a deck is drawn in is presentation, and the pure core is not the place to learn it.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/components/PlayingCard.tsx` — the `cx("card", "s-" + card.s, …)` call on the card root
  (line 71) and one comment above it. `const m = SM[card.s]`, the glyph, the chip corner, the
  portraits and the `isStone` early return are untouched.
- `src/index.css` — two rules after `.card.s-C` (line 511), inside the same `/* cards */` block.
  `:root` (lines 18–22) is not edited.
- `src/test/render.test.tsx` — two cases in the `PlayingCard` block, beside "gives each suit its
  own class, distinct from the others" (~line 1144), using `loadedState({ challenge: … })`.
- `src/test/invariants.test.ts` — one case beside "gives each of the four suits a distinct colour"
  (~line 373), over the `rules` array already parsed from `src/index.css` (~line 343).
- `README.md` — the näyttö bullet in the rules list (~lines 216–220).
- `CLAUDE.md` — the **There are two suit orders, and only one of them may touch the engine**
  section (~line 852), one clause.

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- Any rule or scoring change. `SM[s].red`, `showCardFor`, `legalCards`, `currentWinner`,
  `evalTrick`, `chipValue`, `SUITS` and `HAND_SUITS` are untouched, and `game/seats.test.ts`'s
  pinned literals must not move.
- Giving Tupatro, Nami, Nami Hard, Rock-Paper-Scissors, Tuppi-Rummikub or the roguelike run the
  traditional deck. Seven modes keep four colours; see Assumptions for why Tupatro is the close
  call.
- A setting, voucher, lobby option or rail control that switches decks. The mode decides, and
  `2026-09-16-four-suit-colors`'s refusal of a toggle stands.
- Any catalogue change, including a rules-panel line about the two decks, and any mode-conditional
  wording of `declare.fine`, `btn.showRami`, `btn.showNolo`, `table.declNote`, `table.noloNote` or
  the näyttö item of `rules.tuppi`.
- Colouring a suit glyph anywhere but a card face: the shop's card label, toast card labels, the
  rail plates, `ModeBox` and the `♥`/`♠`/`♦`/`♣` emblems on `JOKERS` and `CHALLENGES` rows all keep
  the colour they inherit, in every mode.
- A second cue for colour vision deficiency.
- The felt, the card back, the enhancement face gradients, the party emblem, and the ♣ King's and
  ♣ Queen's portraits (`2026-09-18-king-of-clubs-ikiliikkuja` owns those).
- Any change to `GameState`, `SAVE_VERSION`, `NET_VERSION`, `SCOPE`, `hashState`, `parseMsg` or
  `guestMay`.
