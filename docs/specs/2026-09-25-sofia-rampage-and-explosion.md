---
id: 2026-09-25-sofia-rampage-and-explosion
title: Give Sofia (the ♥Q) her own animations — a rampage when she wins a Politiikka trick, hair on end and an explosion when she loses a Rock-Paper-Scissors round
kind: ui
status: proposed
---

# Give Sofia (the ♥Q) her own animations in Politiikka and Rock-Paper-Scissors

## What

Sofia, the ♥Q, already carries a rule of her own in two modes. In Politiikka she wins every trick
she is played into (`sofiaIn` / `currentWinner`). In Rock-Paper-Scissors she loses every round she
is revealed in (`rpsCompare`). After this change the felt shows each of those moments with its own
animation:

- **Politiikka.** When a trick resolves and Sofia has won it, her card goes on a short rampage
  across the trick area: it lunges at the other trick cards and returns to her slot, and the cards
  she hits shudder.
- **Rock-Paper-Scissors.** When Sofia's card turns face up and has lost the round, her hair stands
  on end above the card and then the card explodes into fragments, in place of the ordinary
  spin-and-fly-off every other losing card gets.

Both are CSS-only and presentation-only. No rule, score, state field or randomness changes. Under
`prefers-reduced-motion: reduce` neither animation moves anything.

## Prior specs and history

- **No rule is touched, so this contradicts no rule spec.** Sofia's Politiikka rule comes from
  `2026-09-19-politics-challenge-variant` and was kept by `2026-09-20-combine-politics-modes`. Her
  RPS always-loses rule is described in `2026-09-25-rps-draw-higher-card-wins` and in `rps.ts`'s
  header comment. All of them stand unchanged. `sofiaIn`, `currentWinner`, `rpsCompare`,
  `resolveTrick` and `resolveRps` are read, never edited.
- **This partly reverses a visual decision made in hand commits, not in a spec.** Commit `e2508bb`
  first gave Sofia's losing RPS card an effect of its own (`.rpssofia`). Commit `7bfe324` then made
  that fly-away every non-winning card's (`.rpsaway`, decided by `cmp`, not `isSofia`), and
  `render.test.tsx`'s case _"still marks Sofia's own card — she is simply the losing side, not a
  special case"_ pins that reading. **This spec makes her a special case again, on top of
  `.rpsaway`, not instead of it.** Her card keeps the `.rpsaway` class, so the existing test's
  assertion still holds. Only its title and comment become false and must be reworded. Every other
  losing card keeps the plain fly-away exactly as now.
- **Not already delivered.** `Table.tsx` draws a Politiikka trick with `.slot`, `.slot-<pos>` and
  `.win` only, and `index.css` has no rampage keyframes. `RpsTable.tsx`'s `Turned` draws the same
  `.rpsaway` for Sofia as for any other loser, with no hair element and no fragments.
- **Overlaps nothing else.** The Sofia marker (`.sofia`, Politiikka only) and her portrait
  (`sofia.png`, every mode) are untouched.

## Acceptance criteria

Politiikka, the rampage:

- [ ] **`Table.tsx` marks Sofia's winning slot.** When `g.challenge === "politiikka"`,
      `g.winSeat === play.p` and `isSofia(play.card)` (from `game/cards.ts`), that trick slot's
      `<div>` carries the class `sofiarampage`, and every **other** slot of the same trick carries
      `sofiahit`. A `render.test.tsx` case renders `<Table />` over `politicsState({ phase:
"trickend", ... })` with a four-card trick holding the ♥Q and `winSeat` set to her seat. It
      asserts exactly one `.slot.sofiarampage`, that this slot holds the ♥Q, and exactly three
      `.slot.sofiahit`.
- [ ] **No rampage anywhere else.** In the same file, with the same four-card trick holding the ♥Q,
      no `.sofiarampage` and no `.sofiahit` is drawn: (a) in Politiikka during `play` and `resolve`,
      where `winSeat` is `null`; (b) in Politiikka when a trick without the ♥Q has resolved and
      another card won; (c) in trickend with the ♥Q as the winning card, for each of
      `challenge: null`, `"tuppi"`, `"race"`, `"tupatro"`, `"nami"` and `"rummikub"`. Case (c) is
      the vacuity guard. The markup exists only because of the mode gate, not because of the card.
- [ ] **The rampage fits inside the trick's linger.** `nextTick` in `src/game/schedule.ts`, for the
      `trickend` phase, returns a delay of **1250** (the existing scored-trick linger) when
      `g.challenge === "politiikka"` and `sofiaIn(g.trick)` is non-null. Every other trickend keeps
      `g.pop ? 1250 : 650` unchanged, and the tick's `key` does not change. A test in
      `src/game/reducer.test.ts` asserts 1250 for a Politiikka trickend state with Sofia in the
      trick. It also asserts 650 for the same state with a ♥J in her place, and 650 for a
      `challenge: "tuppi"` trickend with the ♥Q in the trick and `pop: null`.
- [ ] **`index.css` defines the rampage.** A `@keyframes` rule animates the card inside
      `.slot.sofiarampage` and another animates the card inside `.slot.sofiahit`. Both run only
      `transform` (and optionally `filter`/`opacity`), end at the card's resting position (no
      `forwards` fill that leaves a card displaced), and finish within **1.0s** of the class
      appearing. That is inside the 1250ms trickend linger above. The rampaging slot is raised above
      the other three (`z-index`) for as long as it moves. The rules must override `.slot
.card.fresh`'s `drop` animation, whether by specificity or by source order.

Rock-Paper-Scissors, hair on end and the explosion:

- [ ] **`Turned` in `RpsTable.tsx` marks Sofia's losing card.** When the revealed card is the ♥Q
      (`isSofia`) and its side **lost** the round (for the viewer's own card `cmp < 0`, for the
      other side's `cmp > 0`), the outer `.rpsflip` span carries both `rpsaway` and `rpsboom`. It
      also contains one `.rpshair` element and exactly **8** `.rpsshard` elements. All of them are
      decorative empty `<span>`s with `aria-hidden="true"` and no text content.
- [ ] **`render.test.tsx` pins it in both positions.** With `rpsState({ phase: "rpsreveal",
rpsCards: [card("H", 12), card("S", 6)] })`, the first `.rpsflip` has `.rpsaway.rpsboom`, one
      `.rpshair` and eight `.rpsshard`. The second (the winning ♠6) has none of `rpsboom`,
      `.rpshair` or `.rpsshard`. With the cards swapped (`[card("S", 6), card("H", 12)]`), the
      second `.rpsflip` has them and the first has none. The existing case _"still marks Sofia's own
      card…"_ keeps its `.rpsaway` assertions. Its title and comment are reworded so they no longer
      say she is "not a special case".
- [ ] **No explosion anywhere else.** No `.rpsboom`, `.rpshair` or `.rpsshard` is drawn: (a) for an
      ordinary losing card (`[card("S", 6), card("D", 9)]`), which still gets plain `.rpsaway`
      exactly as today; (b) during `rpsthrow`, including a half-committed round where the ♥Q is the
      viewer's committed card (`rpsCards: [card("H", 12), null]`); (c) for the same-card tie
      fixture the file already uses (`[card("S", 6), card("S", 6)]`).
- [ ] **`index.css` defines the hair and the explosion, timed inside the round.** The hair rises
      (a `transform` from collapsed to standing) starting no earlier than **0.7s**, after the
      existing `.rpsturn` finishes. The explosion follows. A rule on `.rpsaway.rpsboom` replaces
      `rpsflyaway` with its own keyframes: the card scales up and fades out, and each `.rpsshard`
      travels outward on its own fixed direction (a per-`nth-child` or per-custom-property transform
      written in the stylesheet). Everything finishes by **1.9s** after the card mounts, inside
      `resolveRps`'s 2000ms tick. Shard directions are fixed in CSS. No component draws a random
      number, so the existing invariant ("no component touches `Math.random` or an `Rng`") still
      passes unmodified.
- [ ] **It works wherever the board is drawn.** Because the markup lives in `Turned` inside
      `RpsBoard`, `PrivateTable`'s stage and a spectating window draw the same classes. A
      `render.test.tsx` case renders the Sofia-loses fixture with a spectating net (`stubNet({ role: "table", live: true, seat: null, status: "live" })`, as elsewhere in the file) and
      asserts `.rpsboom` is present.

Reduced motion, both modes:

- [ ] **A `@media (prefers-reduced-motion:reduce)` block in `index.css` names every new moving
      selector.** It sets `animation:none` on the card inside `.slot.sofiarampage` and inside
      `.slot.sofiahit`, and `display:none` on `.rpshair` and `.rpsshard`. For `.rpsaway.rpsboom` it
      falls back to the same behaviour a plain `.rpsaway` card has under reduced motion today: it
      disappears once its delay elapses, with no motion, the same way the existing global
      `animation-duration:.01ms` rule treats `rpsflyaway`. So under reduced motion Sofia's losing
      card is gone exactly when any other loser's is. A test reads `src/index.css` as text, the
      same way `invariants.test.ts` already does (comments stripped, `([^{}]+)\{([^{}]*)\}`
      matching), and asserts that inside a `prefers-reduced-motion:reduce` block there is a rule
      for each of `.sofiarampage`, `.sofiahit`, `.rpshair` and `.rpsshard`. It also asserts each
      `@keyframes` name introduced by this spec is referenced by at least one rule outside that
      block.
- [ ] **No new player-facing text.** `src/i18n/fi.ts` and `src/i18n/en.ts` gain no key. The
      existing `toast.sofia` in Politiikka stays the only textual cue there, and `rps.roundLost` /
      `rps.roundWon` / `rps.roundWonBy` the only one in RPS.
- [ ] **All gates pass:** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

**Subjective, and for the reviewer's eyes rather than a test:** whether the rampage reads as a
_rampage_, and whether the hair and the explosion read as _hair on end_ and _exploding_. jsdom
lays out nothing and plays no animation. Look at it with `npm run dev`: a Politiikka deal until
Sofia is played (the toast `toast.sofia` fires on that trick), and a Rock-Paper-Scissors match until
the ♥Q is revealed. Check at **1280x800**, **1280x500** and **390x844**. The rampaging card must not
leave `.felt` (it is `overflow:hidden`, so a card that would leave is clipped instead). No card may
end displaced after the rampage. The fragments must not overlap the legend lines so badly that they
read as a layout bug. Then turn on reduced motion (DevTools → Rendering → Emulate CSS
`prefers-reduced-motion: reduce`) and confirm nothing moves in either mode.

## Assumptions

- **This is `ui`, not `rule`.** Nothing about who wins a trick or a round changes, and the rules
  panel (`Rules.tsx`) and README describe no animation, so neither is edited. If the reviewer reads
  "animations of her own" as meant to affect play, this spec is wrong.
- **"When Sofia wins a trick" means the `trickend` phase of a Politiikka trick she was played into.**
  That is the only moment `g.winSeat` is set, and in Politiikka she always wins such a trick. The
  gate is written as "the slot whose seat is `winSeat` holds the ♥Q" rather than as
  `sofiaIn(g.trick)`, so it stays true to the requirement's wording if her rule ever changes.
- **The Politiikka trickend linger is lengthened from 650ms to 1250ms for a Sofia trick only.** This
  is the one change outside `src/components/` and `index.css`. The other choice was to squeeze a
  "rampage" into 650ms, which is barely longer than a card's drop. 1250ms is the linger a scored
  trick already gets, so no new timing constant is invented. It costs roughly 0.6s per deal in
  which Sofia is played. Delays are not part of the headless driver's result, the network hash or
  the save, and Politiikka is single-player only, so no measurement, `NET_VERSION` or
  `SAVE_VERSION` moves.
- **"She goes on a short rampage on the felt" means she stays inside the trick area.** She lunges at
  the other three trick cards and they shudder. She does not charge the seats, the mode box or the
  hand, and nothing she hits is moved permanently.
- **"When Sofia loses a round" means every round she is revealed in.** Under the current rule she
  can only lose (`rpsCompare` has her lose to every other card, and the deck holds one ♥Q). The gate
  is still written as "her side lost" (`cmp` strictly against her) rather than "she was revealed",
  so a future rule change that let her win or tie would not blow her up on a win.
- **"Her hair stands on end" is drawn as a decorative overlay above the card, not by editing
  `src/assets/sofia.png`.** The portrait is a raster image with no separable hair layer. A CSS/SVG
  hair element rising from the card's top edge is the only way to animate hair without a new asset.
  The exact drawing (spikes, strands, colour) is left to the implementer, and a reviewer judges it
  by eye.
- **The explosion replaces the fly-away for her card only, and keeps the `.rpsaway` class.** Keeping
  the class means every existing "which card lost" assertion still holds, and the new animation is
  an override (`.rpsaway.rpsboom`), not a parallel mechanism. Every other losing card keeps
  `rpsflyaway` unchanged.
- **Fragments are a fixed set of 8 with directions fixed in CSS.** Rendering may not consume
  randomness (a delivered invariant), so the explosion looks the same every time. That is accepted.
- **Reduced motion means "no motion", not "a different animation".** Under reduced motion there is
  no rampage, no shudder, no hair and no fragments. Sofia's losing RPS card vanishes exactly when
  any other losing card does under the existing global reduced-motion rule, so the felt still shows
  the round is over. No replacement cue (glow, flash) is added. A flash would itself be the kind of
  effect reduced-motion users opt out of, and the verdict line and the Politiikka toast already say
  what happened.
- **Only Politiikka and Rock-Paper-Scissors get these animations.** The ♥Q in every other mode,
  including her portrait, stays a plain card.
- **Multiplayer RPS needs nothing extra.** The animation is decided by the two revealed cards, which
  every peer holds identically. Nothing is added to `GameState`, `hashState`, `SCOPE` or the wire,
  so `NET_VERSION` stays where it is.

## Touch points

- `src/components/table/Table.tsx` — add `sofiarampage` / `sofiahit` to the trick slot's `cx(...)`,
  gated on `g.challenge === "politiikka"` and on the `winSeat` slot holding `isSofia`. Import
  `isSofia` from `game/cards`.
- `src/components/table/RpsTable.tsx` — `Turned` gains a `boom` prop (or computes it). The two call
  sites in `RpsBoard` pass it from `cmp` and `isSofia`. When set, it adds `rpsboom` and draws the
  `.rpshair` span and eight `.rpsshard` spans, all `aria-hidden`. Update `Turned`'s header comment,
  which currently says the effect is "every non-winning card's, `cmp` decides it rather than
  `isSofia`".
- `src/game/schedule.ts` — `nextTick`'s `trickend` case: a 1250ms linger for a Politiikka trick with
  Sofia in it (`sofiaIn` from `./politics`, already pure core), with a why-comment.
- `src/index.css` — the rampage and hit keyframes and their rules near `.slot .card.fresh`; the
  hair, the shards and the `.rpsaway.rpsboom` override near `.rpsaway`; one reduced-motion block
  covering all of them.
- `src/test/render.test.tsx` — the Politiikka rampage cases, the RPS explosion cases, the spectating
  case, and the rewording of _"still marks Sofia's own card — she is simply the losing side, not a
  special case"_ and of the `.rpsaway` describe block's header comment.
- `src/game/reducer.test.ts` (or a new `src/game/schedule.test.ts`) — the trickend delay cases.
- `src/test/invariants.test.ts` or `src/test/render.test.tsx` — the CSS-text check for the
  reduced-motion block and the keyframes references (reuse the existing parse shape).

## Out of scope

- Any change to Sofia's rules in either mode (`sofiaIn`, `currentWinner`, `rpsCompare`), to
  scoring, to the target, or to the rules panel and README text.
- Animations for the ♥Q in any other mode, or for the other honours (♣K, ♣Q, the Politiikka ♦K /
  ♠Q caricatures).
- A new portrait asset, or editing `sofia.png`.
- Sound.
- A per-player setting to turn the animations off. The OS-level reduced-motion preference is the
  only switch.
- Changing any delay other than the Politiikka Sofia trickend linger, including `resolveRps`'s
  2000ms and `showRpsOver`'s 2600ms.
- The plain `.rpsaway` fly-away for every other losing card, and the unreachable tie branch that
  flies both cards off. Both stay exactly as they are.
- Animating in `PrivateTable` beyond what it already inherits from `RpsBoard`. Politiikka never
  reaches a shared table, since it is single-player only.
