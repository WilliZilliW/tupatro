---
id: 2026-09-18-king-of-clubs-ikiliikkuja
title: In Tupatro, playing the King of Clubs draws its player an extra temppu ("Ikiliikkuja")
kind: rule
status: proposed
source: Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi> — **neither source knows a card with an effect of its own.** In tuppi every card does exactly one thing: it follows suit and the highest card of the led suit takes the trick, ace high (ace low in sooli). The ♣K is an ordinary king in both sources, and no source mentions a one-shot item a player spends mid-deal at all — that is the roguelike's shell, which `2026-09-16-tupatro-match-mode-with-consumables` already put over a traditional deal under this game's own name. The contradiction, and the chosen reading of it, are written out under Source below.
---

# In Tupatro, playing the King of Clubs draws its player an extra temppu ("Ikiliikkuja")

## What

In **Tupatro matches only**, the King of Clubs — the one card that already shows a portrait instead
of a pip — stops being an ordinary king. The moment a player plays it into a trick, that player
draws one extra temppu, by exactly the rule `startDeal` already uses for the mode's per-deal supply:
the draw is taken whatever the box holds, kept only for a `"human"` seat with room, and discarded
otherwise. The player is told so by a toast nobody else's window draws.

The card is nicknamed **Ikiliikkuja** — he leaves, but he always comes back with something. No other
mode changes: the race, Traditional Tuppi, both Nami variants, Tuppi-Rummikub and the main
roguelike run all keep the ♣K as a king and nothing else, and every pinned golden and measured
figure outside Tupatro stays where it is.

## Prior specs and documents

Several delivered specs carry `status: proposed` in their front matter; `CLAUDE.md` is the record of
what is actually built, and the readings below are taken from it and from the code.

- **Extends `2026-09-16-tupatro-match-mode-with-consumables` (delivered).** That spec's mode, its
  supply, its addressed toasts (`Toast.p`) and its `consSlots` cap of 2 are all reused unchanged.
  Its Out-of-scope line **"New temput. The table stays the five in `CONSUMABLES`; none is retuned or
  reworded"** is honoured literally: this adds no sixth temppu and rewords none. What it adds is a
  second **source** of the same five.
- **It does narrow one property that spec stated in prose, and that is the one thing a reviewer must
  see.** Its supply table says a Tupatro deal costs **a fixed amount of randomness** (four `pick`
  calls, always). After this change a deal's randomness cost also depends on whether the ♣K reaches
  a trick and on nothing else — in a sooli it can sit in the sitting-out partner's hand and never be
  played, and a `uusijako` can put a freshly minted ♣K back into play (see Assumptions). **The
  reason that property existed is untouched**: the draw at the play site is taken whether it is kept
  or discarded, so what a seat is _holding_ still cannot change what the _next_ deal deals. The
  literal sentence must be corrected, in `TUPATRO_DRAW`'s comment, in `CLAUDE.md` and in `README.md`,
  rather than left standing while the code disagrees with it.
- **Overlaps the portrait itself, which shipped with no spec** (commit "Put vaykka.png on the King of
  Clubs card face", and its follow-up reframing). That art is delivered and is not re-litigated here;
  this spec only requires that the face test behind it and the face test behind the new effect become
  the **same** function, so the two can never name different cards.
- **Touches `2026-09-16-four-suit-colors` (delivered) not at all.** Clubs keeps its colour and
  `SUITS` / `HAND_SUITS` are untouched — reordering either would move every seeded run.
- **Inherits `2026-09-08-webrtc-transport` and `2026-09-08-shared-table-view-multiplayer`.** No new
  action, no new `NetMsg`, no `SCOPE` entry and no `hashState` field: the wallets' consumable ids are
  already hashed and `rngState` already is. What does move is `NET_VERSION`, for the ordinary reason
  a reducer rule change moves it.
- **Nothing here is already delivered.** `grep -n "isKingOfClubs" src/` finds one inline test in
  `PlayingCard.tsx` and nothing in `src/game/`; `playCardInner` takes no `Rng` and draws nothing.
- **Contradicts no delivered decision.** No other mode's rules, arithmetic, targets or boards change.

## Acceptance criteria

- [ ] **One gated site, in the reducer.** `playCardInner` in `src/game/reducer.ts` gains an
      `rng: Rng` parameter (both call sites, the `playCard` and `aiPlay` cases, already hold one),
      and after the card is pushed onto `d.trick` it draws for the seat that played it **only when
      `d.challenge === "tupatro"`** and the card's face is the King of Clubs: `TUPATRO_DRAW` ×
      `pick(rng, CONSUMABLES)`, kept only when `d.seats[p] === "human"` and
      `econOf(d, p).consumables.length < econOf(d, p).consSlots`. Tests in `reducer.test.ts`: a human
      seat playing ♣K in a Tupatro deal holds one more temppu; an AI seat playing it holds none; a
      seat whose box is already full still holds exactly `consSlots`.
- [ ] **No other mode reaches it, and the goldens prove it.** A `reducer.test.ts` case plays the ♣K
      in `"tuppi"`, `"race"`, `"nami"`, `"namihard"`, `"rummikub"` and a main-game run and asserts
      every box and every `rngState` is byte-identical to the same play without the branch.
      `game/seats.test.ts`'s three pinned seeds, its 50-seed aggregate and every race / Traditional /
      Nami / Tuppi-Rummikub figure in `README.md` are **unmoved**.
- [ ] **The face test is one pure function, shared with the portrait.** `src/game/cards.ts` exports
      `isKingOfClubs(c: Card): boolean` (`c.s === "C" && c.r === 13`); `PlayingCard.tsx`'s inline
      `card.s === "C" && card.r === 13` is replaced by a call to it, and the reducer calls the same
      one. A comment says why this reads the face and not `uid`: it is a card-**type** question
      ("is this the King of Clubs"), not an identity comparison, so the project's uid rule does not
      apply — and `game/cards.test.ts` or `rules.test.ts` pins that every deck holds exactly one card
      for which it is true.
- [ ] **The randomness is spent either way, and a Tupatro deal still replays.** The `pick` happens
      before the keep/discard test, exactly as `startDeal`'s loop does, so a discarded draw costs the
      same cursor movement as a kept one. A test drives the same Tupatro seed twice through
      `game/drive.ts` and asserts identical `rngState`, identical hands and identical boxes after the
      trick the ♣K was played in. `useGameLoop` stays the only `setTimeout` site and `makeSeed()` the
      only `Math.random` site.
- [ ] **`TUPATRO_DRAW` gains the second site in its comment, and the "fixed randomness per deal"
      sentence is corrected wherever it is written** — `src/game/constants.ts`, `CLAUDE.md`'s Tupatro
      bullets and `README.md`'s Tupatro supply bullet. The surviving claim is the narrower, true one:
      _what a seat is holding cannot change what the next deal deals_.
- [ ] **Two addressed toasts, and no window but the player's draws either.** `toast.ikiliikkuja`
      carries `p` and the drawn temppu's name through the existing `nameKey` (`{name}` in both
      locales); `toast.ikiliikkujaFull` carries `p` and no placeholder, and fires when the draw was
      discarded because the box was full. `Toasts.tsx` and the `Toast` type are **unchanged** —
      `p?: Seat` already exists. Render cases in `render.test.tsx`, in both locales: the kept-draw
      toast appears on the playing seat's window, and on neither another seat's window nor a shared
      table's.
- [ ] **Text lives only in the catalogues.** The two toast keys and the new rules bullet go into
      `src/i18n/fi.ts` first; `src/i18n/en.ts` does not compile until it has them. Placeholder sets
      match across locales, no new data-table row is added (so `nameOf` / `descOf` / `emblemOf` are
      untouched), no string names a real person, and `i18n.test.ts` passes with no change to its
      stopword list.
- [ ] **The rules panel teaches it, and only in the Tupatro section.** `rules.tupatro` gains one
      bullet in both locales: the ♣K's nickname, that playing it draws one extra temppu for the seat
      that played it, the human-with-room condition, and plainly that **no tuppi source knows this** —
      in tuppi the ♣K is an ordinary king. `rules.tuppi`, `rules.race`, `rules.nami` and the
      "what comes from tuppi" section gain nothing. `Rules.tsx` needs no new heading.
- [ ] **`NET_VERSION` goes to 10, with the reason in its comment.** A v9 peer's reducer draws
      nothing, so the first ♣K played in a Tupatro match diverges `rngState` and one wallet's box on
      that peer alone — the wire shape is unchanged, which is exactly the case v3, v6 and v7 already
      set. `SCOPE`, `guestMay`, `parseMsg`, the `NetMsg` union and `hashState` gain **no** member
      (consumable ids and `rngState` are already hashed), and `protocol.test.ts` still asserts the
      `local`-exception list is length two.
- [ ] **No state shape moves.** `GameState` gains no field, `SAVE_VERSION` stays **3**, and there is
      no new `Phase`, `Screen` kind, `Modal`, `Action` member or `setTimeout` call site. A
      `save.test.ts` case round-trips a Tupatro state whose human seat holds a box filled by this
      effect and plays on identically.
- [ ] **The pace is re-measured headlessly, on the same seeds as the delivered table.** 200 seeds
      `TUPATRO0`…`TUPATRO199`, `humans: 4`, `playRace(seed, basicPolicy, 4, 2000, "tupatro")`, with
      the same 200 seeds at `mode: "tuppi"` as the baseline — `src/test/bot.ts` needs no change, since
      `Policy.useTrick` and `playRace`'s per-turn offer already exist. Every match must finish.
      Median, mean, p10–p90, min–max and the share of deals in which a temppu was spent **replace**
      `README.md`'s Tupatro table, dated, with the pre-change Tupatro row re-measured **in this tree
      on the same day** and labelled as the before figure. `TUPPI_TARGET` stays 52 whatever the pace
      says.
- [ ] **Docs.** `README.md`'s Tupatro section gains the ♣K bullet and the new figures, and its stale
      "`NET_VERSION` moved to **8**" sentence is corrected (the code says 9 today, 10 after this);
      `CLAUDE.md`'s Tupatro bullets name the new draw site, the shared face helper and the version;
      `docs/multiplayer.md`'s version line follows.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The effect fires on the play, in `playCardInner`, for any seat — an AI seat included**, whose
  draw is taken and thrown away. The requirement's "that player" is read as the seat that played the
  card, and "the same draw rule `startDeal` already uses" is read as including the unconditional
  `pick`. Gating the `pick` itself on `"human"` would have been the other reading; it was rejected
  because it makes a deal's randomness depend on _who holds_ the card rather than on the card being
  played, which is the property `TUPATRO_DRAW`'s comment defends.
- **"One extra temppu" is `TUPATRO_DRAW`, not a literal 1.** The constant is reused so that retuning
  the supply moves both sites together. If a reviewer wants the two to differ, that is a second
  constant and a second comment.
- **The face test is suit + rank, not `uid` and not a string compare on `id`.** A **stone**-enhanced
  ♣K would therefore still trigger, although a stone card has neither suit nor rank in play. That is
  unreachable in a match — no shop, no tuppipakka, no enhancement source — so it is stated here and
  in a comment rather than branched away.
- **A second toast for the wasted draw is added beyond the literal requirement.** The requirement
  asked for one toast, for the bonus; a full box that swallows the draw in silence reads as a bug to
  the player who just played the card, so `toast.ikiliikkujaFull` exists. Both are addressed.
- **The kept-draw toast names the temppu that was drawn.** That is safe only because the toast is
  addressed: broadcast, it would tell the table what is in the player's box. If the addressing rule
  is ever relaxed, this string must lose the name.
- **"Ikiliikkuja" stays Finnish in both locales**, like "Tupatro" and the tuppi terms — it is the
  nickname of the effect, not a word to translate ("perpetual motion machine" loses the reference).
  The English string explains the joke (he leaves, and comes back with something) instead.
- **No string names a real person.** The card art already carries `alt=""` and no catalogue string
  says "Väyrynen"; the requirement's background names him, the game's text does not. A reviewer who
  wants the portrait named is asking for a decision about a living politician's name in the product,
  which is not made silently here.
- **`uusijako` can make the effect fire twice in one deal, and that is not special-cased.** The
  redeal's guard is `trickNo > 0`, so it is legal while the first trick is part-played; `dealCards`
  mints a fresh deck, so a ♣K already played can be dealt and played again. The cost is one extra
  draw in a rare corner, and a per-deal "already drawn" flag would be a new `GameState` field for it.
- **The ♣K can go a whole deal unplayed**, most obviously in a sooli, where the soloist's partner
  sits out with thirteen cards. Nobody draws then; that is intended, not a gap.
- **Nothing on the card face or in a tooltip says the card is special.** The rules panel is the only
  place it is taught, so a player who has not read it meets the effect as a surprise toast. A badge
  on the ♣K in Tupatro is a `ui` spec of its own.
- **Bots discard the draw, so this widens the mode's existing lopsidedness in the humans' favour.**
  `chooseAI` still never spends a temppu — teaching it to remains the obvious next spec — and the
  re-measurement reports the pace, not a fairness figure.
- **`NET_VERSION` 10 shuts v9 peers out of every mode, not only Tupatro.** The ordinary rule, and the
  ordinary trade: the alternative is a v9 peer playing a Tupatro match that desyncs on one card.
- **The measurement is expected to lengthen Tupatro matches again**, on the delivered table's own
  reasoning (a spent temppu can turn a short deal into a long rise). The criterion does not require
  any particular direction — whatever the 200 seeds say goes into the README, and 52 does not move.

## Touch points

The files and functions this is expected to change. Named from the code as it stands.

- `src/game/cards.ts` — new `isKingOfClubs(c: Card): boolean`, beside `isStone` / `isWild` /
  `sameFace`, with the type-versus-identity comment.
- `src/game/reducer.ts` — `playCardInner` gains `rng: Rng` and the gated draw; the `playCard` and
  `aiPlay` cases pass the cursor they already hold; the two new `toast()` calls carry `p`.
- `src/game/constants.ts` — `TUPATRO_DRAW`'s comment: the second draw site, and the corrected
  randomness claim.
- `src/components/PlayingCard.tsx` — the inline `card.s === "C" && card.r === 13` becomes the shared
  helper.
- `src/net/protocol.ts` — `NET_VERSION` to 10 and its comment. `hashState`, `SCOPE`, `guestMay`,
  `parseMsg` and `NetMsg` unchanged.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `toast.ikiliikkuja`, `toast.ikiliikkujaFull`, one new
  `rules.tupatro` bullet.
- `src/components/screens/Rules.tsx` — no code change expected; the bullet arrives through
  `tList("rules.tupatro")`.
- `src/game/reducer.test.ts` — the keep / discard / full-box / other-mode / replay cases.
- `src/game/rules.test.ts` or a new `src/game/cards.test.ts` — one ♣K per deck.
- `src/game/save.test.ts` — the Tupatro round trip after the effect filled a box.
- `src/net/protocol.test.ts` — the version and the unchanged exception list.
- `src/test/render.test.tsx` — the addressed-toast cases in both locales, including a shared table.
- `README.md`, `CLAUDE.md`, `docs/multiplayer.md` — the bullet, the figures and the version.

## Out of scope

- **The effect in any other mode or in the main roguelike run.** The race, Traditional Tuppi, both
  Nami variants, Tuppi-Rummikub and the main game keep the ♣K as a plain king; a criterion pins
  their boxes, `rngState` and goldens unmoved.
- **Any other card getting an effect of its own**, and any second portrait. One card, one mode.
- **A badge, tooltip, animation or highlight on the ♣K**, in Tupatro or anywhere else. The rules
  panel is the only teacher this spec adds.
- **A sixth temppu, or any retune of the five in `CONSUMABLES`** — including their prices, glyphs and
  descriptions.
- **`consSlots` tuning, a slots upgrade or a discard picker in this mode.** A full box still wastes
  the draw.
- **An AI that spends temput.** Still needs a new `auto` action, a `nextTick` arm, a `SCOPE` entry
  and a heuristic; still the obvious next spec.
- **Any arithmetic change.** `dealPoints`, `tuppiInfo`, `tuppiMult`, `finalScore`, `scoreTrick`,
  `dealScores`, `namiTrick` and every target are untouched, `TUPPI_TARGET` included.
- **Naming Väyrynen in any player-facing string**, and any change to `alt=""` on the portrait.
- **A new `Phase`, `Screen` kind, `Modal`, `Action` member, `NetMsg` member, `GameState` field, a
  `SAVE_VERSION` bump or a second `setTimeout` call site.**
- **Late joining, reconnect, an AFK timer, a networked match filing a board row, and the lobby's
  Start staying enabled mid-match** — all recorded Known gaps, none touched.
- **A multi-human Tupatro save.** `soloBoard` still gates the run slot, exactly as before.

## Source

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** — the play itself: the
  deal, the declaration (rami / nolo), maantuntopakko, the trick winner, sooli with its sit-out and
  exchange, and ryöstö. **It gives no card an effect of its own.** The ♣K is a king: it follows suit,
  it beats a queen and it loses to an ace, and in sooli the ace is lowest. Nothing in the sheet
  changes what a card does when it is played.
- **<https://korttipeliopas.fi/tuppi>** — the point table, the ryöstö doubling, the 24 either way on
  a sooli and the 52 to win. Read again for this spec, and it likewise knows no special card and no
  item spent mid-deal.
- **The contradiction, stated rather than implemented quietly.** The requirement asks for a card
  effect that neither source contains and that tuppi's own logic has no room for. The chosen reading
  is the one `2026-09-16-tupatro-match-mode-with-consumables` already established and that the rules
  panel already states in as many words: **Tupatro is not tuppi and does not claim to be.** It is
  this game's own mode — the roguelike's shell laid over a traditional deal — so an invented card
  effect belongs there and nowhere else. What must not happen is the reverse: Traditional Tuppi keeps
  playing the source's game, and the `rules.tuppi` section that describes what comes from tuppi stays
  free of both the temput and this card.
- **The chosen reading, to be written into the comment above the draw in `playCardInner`:** the ♣K's
  effect is _arrival_, not _interference_. It changes no trick, no suit, no rank, no declaration and
  no score — the card wins or loses its trick exactly as a king does — and adds only one draw for the
  seat that let it go. That is what makes it safe to bolt onto a traditional deal at all: every rule
  the two sources do state still decides the trick it was played into.
