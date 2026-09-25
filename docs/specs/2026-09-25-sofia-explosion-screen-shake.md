---
id: 2026-09-25-sofia-explosion-screen-shake
title: Make Sofia's Rock-Paper-Scissors explosion spectacular, and shake the whole UI with it
kind: ui
status: proposed
---

# Make Sofia's Rock-Paper-Scissors explosion spectacular, and shake the whole UI with it

## What

Sofia (the ♥Q) already explodes when she loses a Rock-Paper-Scissors round. That explosion was
delivered by `2026-09-25-sofia-rampage-and-explosion`, and today it is small: the card grows to
1.4× and fades, and eight 6px gold squares drift up to about 35px away. After this change the
explosion is large. The card blows up bigger and brighter, a flash and an expanding shockwave ring
burst out from it, and twice as many fragments fly much further. The moment it goes off, the
whole game UI (`#app`: the rail, the felt and the hand) shakes from the blast for a fraction of a
second. The requirement, verbatim: _"Tee Sofian räjähdyksestä näyttävä. Koko UI voi täristä
räjähdyksen voimasta"_ ("Make Sofia's explosion spectacular. The whole UI may shake from the force
of the explosion").

This is presentation only. No rule, score, state field, delay, randomness or wire message changes.
Under `prefers-reduced-motion: reduce` nothing shakes, flashes or flies.

## Prior specs and history

- **Overlaps `2026-09-25-sofia-rampage-and-explosion` (delivered, merged in #68), and this spec is
  scoped to the difference.** That spec's gate stays: which card explodes (`.rpsboom` on top of
  `.rpsaway`, only when the revealed ♥Q's side lost), the hair on end, the timing window (hair from
  0.7s, the bang from 1.0s, everything done by 1.9s, inside `resolveRps`'s 2000ms tick), and every
  vacuity case (ordinary loser, `rpsthrow`, tie, spectating). This spec only makes the bang
  bigger and adds the UI-wide shake.
- **One of that spec's numbers is reversed, on purpose.** It fixed the fragment count at
  **exactly 8** (`.rpsshard`), and `render.test.tsx` asserts `toHaveLength(8)` in two cases. This
  spec raises it to **exactly 16**, and those two assertions (and their test titles) change with
  it. This is the only criterion of the earlier spec that stops being true. The reviewer should see
  it as a deliberate change.
- **The Politiikka rampage from the same earlier spec is untouched.** It is not an explosion. See
  Assumptions.
- **No rule spec is contradicted.** Sofia's always-loses rule in `rpsCompare` (`game/rps.ts`, and
  `2026-09-25-rps-draw-higher-card-wins`) is read, never edited.
- **Not already delivered.** `index.css` today has `rpsexplode` scaling to 1.4 only, eight shards at
  up to about 35px, no flash, no ring, and no rule anywhere that animates `#app`.
- **`2026-09-23-rps-two-player-multiplayer` needs nothing extra.** The gate is computed from
  `g.rpsCards` and `g.phase`, which every peer holds identically (both are hashed state already).
  So both players' windows and a shared table all shake at the same beat, and nothing is added to
  the wire.

## Acceptance criteria

The gate, one function for the card and the screen:

- [ ] **`game/rps.ts` exports `sofiaBlast(cards: [Card | null, Card | null]): 0 | 1 | null`.** It
      returns the team index whose card is the ♥Q (`isSofia`) and lost the round by `rpsCompare`
      (strictly less than zero from that side). If either slot is `null`, or neither card is an
      exploding Sofia, it returns `null`. It is pure: no state, no RNG, no i18n. `game/rps.test.ts`
      asserts: `[H12, S6]` → `0`; `[S6, H12]` → `1`; `[S6, D9]` → `null`; `[H12, null]` → `null`;
      `[null, H12]` → `null`; `[S6, S6]` → `null`; and `[H12, C13]` → `0` (she loses to the ♣K
      too).
- [ ] **`RpsBoard` in `RpsTable.tsx` decides `.rpsboom` through `sofiaBlast`.** It is computed
      only when `g.phase === "rpsreveal"`, so the card and the screen shake can never disagree.
      Every existing `.rpsboom` render case in `render.test.tsx` still passes unchanged apart from
      the shard count below.

A bigger explosion on the card:

- [ ] **`Turned` draws the new decorative pieces.** When the card explodes, its `.rpsflip.rpsboom`
      span contains exactly one `.rpshair`, exactly one `.rpsflash`, exactly one `.rpsshock` and
      exactly **16** `.rpsshard`. Every one of them is an empty `<span>` with `aria-hidden="true"`.
      A card that does not explode contains none of the four. The two existing cases _"marks her
      card .rpsboom with one .rpshair and eight .rpsshard, mine"_ and _"…the other seat"_ are
      updated to 16, renamed to match, and extended to assert one `.rpsflash` and one `.rpsshock`.
      The ordinary-loser, `rpsthrow` and tie cases also assert no `.rpsflash` and no `.rpsshock`.
- [ ] **The fragments fly far, each on its own fixed path.** `src/index.css` gives the 16 shards
      16 distinct `(--dx, --dy)` pairs, written in rules whose selector names `.rpsshard`. At
      least one pair is 80px or more from the origin (`hypot(dx, dy) >= 80`). A test in
      `src/test/invariants.test.ts` parses `index.css` as text, with the same comment-stripping and
      `([^{}]+)\{([^{}]*)\}` parse the existing reduced-motion describe uses, and asserts both.
      The directions stay fixed in CSS. No component draws a number, so the existing invariant
      "does not consume randomness while rendering" passes unmodified.
- [ ] **`index.css` defines the bigger bang.** It must contain each of the following (a reviewer
      reads the file; the keyframes names are also covered by the test below):
  - `rpsexplode` on `.rpsaway.rpsboom` ends at `scale(1.8)` or more with `opacity:0`.
  - `.rpsflash` runs a `rpsflash` keyframes: a bright radial burst centred on the card that grows
    and fades out. It plays exactly once (no `infinite`, no iteration count above 1) and stays
    inside the card's own area (`.rpsflip`, `position:relative`). It is never a full-viewport
    flash.
  - `.rpsshock` runs a `rpsshock` keyframes: a ring (a `border` on a `border-radius:50%` box) that
    expands from the card and fades out.
  - Every piece of the bang, including the card's own `rpsexplode`, starts no earlier than **1.0s**
    after the card mounts and finishes by **1.9s** (animation-delay plus duration). The hair's own
    timing (0.7s to 1.0s) is unchanged.

The whole UI shakes:

- [ ] **`App.tsx` adds the class `sofiaquake` to `#app`** exactly when
      `g.challenge === "rps" && g.phase === "rpsreveal" && sofiaBlast(g.rpsCards) !== null`. It
      reads the state through `useGameState()`. `render.test.tsx` renders `<App />` through
      `renderWith` and asserts:
  - `#app.sofiaquake` is present for `rpsState({ phase: "rpsreveal", rpsCards: [card("H", 12), card("S", 6)] })`,
    for the swapped pair, and for the first fixture on a spectating window
    (`stubNet({ role: "table", live: true, seat: null, status: "live" })`).
  - It is absent for an ordinary loser (`[card("S", 6), card("D", 9)]`), for `rpsthrow` with
    `[card("H", 12), null]`, for the tie fixture `[card("S", 6), card("S", 6)]`, and for a
    Politiikka `trickend` state where Sofia has won the trick (the rampage fixture already in the
    file). That last one is the vacuity guard: the class is about the RPS explosion, not about the
    ♥Q appearing anywhere.
  - In every one of those fixtures, `#app.sofiaquake` is present if and only if exactly one
    `.rpsboom` is drawn.
- [ ] **`index.css` defines the shake on `#app.sofiaquake`.** It is a `sofiaquake` keyframes that
      animates `transform` only (translate, optionally a small rotate). It has an
      `animation-delay` of **1.0s**, so it lands on the bang. The duration is at most **0.7s**.
      The peak offset is between **6px and 14px**, and the shake decays towards the end. The first
      and last keyframes are `transform:none`, and there is no `forwards`/`both` fill. This matters
      because a transform left on `#app` would make it the containing block of every
      `position:fixed` descendant and leave the layout displaced. The class stays on for the
      whole `rpsreveal` phase, but the animation plays once, because the class is only added when
      the phase turns to `rpsreveal`.
- [ ] **Only `#app` shakes.** `.overlay`, `Toasts`, `NetBanner` and `.privbar.float` are siblings of
      `#app` in `App.tsx`, not children, so they do not move. No rule targets `body`, `html` or
      `#root` with `sofiaquake`.

Reduced motion and text:

- [ ] **The reduced-motion block names every new moving selector.** Inside
      `@media (prefers-reduced-motion:reduce)` in `index.css`: `#app.sofiaquake` gets
      `animation:none`, and `.rpsflash` and `.rpsshock` get `display:none` (beside the existing
      `.rpshair` and `.rpsshard` rules). The existing describe in `invariants.test.ts`
      (_"reduced motion covers Sofia's rampage and her RPS explosion"_) extends its selector list
      with `.sofiaquake`, `.rpsflash` and `.rpsshock`. It also extends its keyframes list with
      `sofiaquake`, `rpsflash` and `rpsshock`, each of which must be referenced by an
      `animation:` rule outside that block.
- [ ] **No new player-facing text.** `src/i18n/fi.ts` and `src/i18n/en.ts` gain no key.
- [ ] **All gates pass:** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

**Subjective, and for the reviewer's eyes rather than a test:** whether the explosion reads as
_näyttävä_ (spectacular) and whether the shake reads as the blast's force rather than a glitch.
jsdom lays out nothing and plays no animation. Run `npm run dev` and play a Rock-Paper-Scissors
match from Single player until the ♥Q is revealed. She is in every match's 41-card deck, but not
always in the six cards dealt, so it may take a few matches. Check at **1280x800**, **1280x500**
and **390x844**:

- The shake lands on the bang, not on the turn.
- Nothing is left displaced after it: the rail, the felt and the hand sit exactly where they did.
- The shards are clipped at `.felt`'s edge (it is `overflow:hidden`) rather than spilling over the
  rail.
- The flash is confined to the card area and happens once.
- The round's verdict line (`.rpsoutcome`) is still readable once the bang is over.

Then turn on DevTools → Rendering → Emulate CSS `prefers-reduced-motion: reduce` and confirm
nothing shakes, flashes or flies. Sofia's card should simply vanish when any other loser's would.

## Assumptions

- **"Sofian räjähdys" means the Rock-Paper-Scissors explosion only.** That is the one thing in the
  game that explodes. Sofia's Politiikka rampage (`.sofiarampage` / `.sofiahit`) is a lunge, not an
  explosion. It gets no shake and no change, and a Politiikka Sofia trick must **not** shake the
  UI (it is a criterion). If the user meant the rampage too, this spec is too narrow.
- **"Koko UI" is `#app`: the rail, the felt and the hand.** That is everything on screen during a
  Rock-Paper-Scissors round. Toasts, the net banner, the private-table float bar and overlays sit
  outside `#app` and stay still. They are the parts that carry text a player may be reading, and
  no result overlay is up at the moment of the bang (`showRpsOver` comes later). Shaking `body`
  instead was rejected. It would drag the fixed-position overlays and toasts along, and it would
  give no class hook that `App.tsx` owns.
- **"Voi täristä" ("may shake") is read as "shakes, every time Sofia explodes".** It is not optional
  per player and has no setting. The OS reduced-motion preference is the only switch, the same one
  the earlier spec used.
- **The shake is a single short decaying burst (at most 0.7s, 6–14px peak).** It is not a
  sustained rumble. The numbers are this spec's own choice: large enough to read as force at
  390px wide, small enough not to push the rail or the hand visibly off the viewport edge. `body`
  is `overflow:hidden`, so a translate on `#app` cannot create scrollbars. A reviewer who wants
  more or less changes one keyframes block.
- **The fragment count goes from 8 to 16, reversing one number of the delivered spec.** More,
  further-flying fragments are the most direct reading of "spectacular". The earlier count was an
  implementation choice, not a requirement from the user.
- **The flash is a single burst confined to the card area, never a full-screen white-out.** A
  full-viewport flash would be a photosensitivity risk and would hide the verdict line. One flash
  in total is well under WCAG 2.3.1's three-flashes-per-second limit.
- **The gate lives in `game/rps.ts` as `sofiaBlast`, not in a component.** `App.tsx` and `RpsTable.tsx`
  both need it. One pure function means the shake and the card's explosion cannot drift apart. It
  asks a rule question ("whose ♥Q lost this round"), which fits the module. It reads no state and
  touches no i18n, so the pure-core invariant holds.
- **No timing outside CSS changes.** `resolveRps`'s 2000ms, `showRpsOver`'s 2600ms and the hair's
  0.7s start all stay. The bigger bang fits in the same 1.0s–1.9s window the earlier spec reserved.
  No new `setTimeout`, and `useGameLoop` stays the only timer site.
- **Multiplayer, the shared table and `PrivateTable` get the shake for free.** The class is derived
  from hashed state every peer holds, and `PrivateTable` renders inside `#app`. `NET_VERSION`,
  `SAVE_VERSION`, `SCOPE` and `hashState` do not move.
- **No README or rules-panel change.** Neither describes animations. `CLAUDE.md`'s
  Rock-Paper-Scissors section may gain one sentence naming `sofiaBlast` and the `#app.sofiaquake`
  hook, but that is optional documentation, not a gate.

## Touch points

- `src/game/rps.ts`: add and export `sofiaBlast(cards)`, with a why-comment (one gate for the card's
  explosion and the UI shake).
- `src/game/rps.test.ts`: the seven `sofiaBlast` cases.
- `src/components/table/RpsTable.tsx`: `RpsBoard` computes `sofiaBlast(g.rpsCards)` when revealed
  and passes each `Turned` its `boom`. `Turned` draws `.rpsflash`, `.rpsshock` and 16 `.rpsshard`
  (was 8) beside `.rpshair`. Update `Turned`'s header comment.
- `src/App.tsx`: read `useGameState()`, compute the gate, and add `sofiaquake` to `#app` through
  `cx` (from `components/cx`).
- `src/index.css`: grow `rpsexplode`; add the `.rpsflash`/`rpsflash` and `.rpsshock`/`rpsshock`
  rules near `.rpsshard`; re-cover the shard `nth-child` rules for 16 shards at the new sibling
  positions (the flash and ring shift them); add `#app.sofiaquake` and `@keyframes sofiaquake`;
  extend the existing Sofia reduced-motion block.
- `src/test/render.test.tsx`: update the two shard-count cases, extend the vacuity cases, and add
  the `<App />` `#app.sofiaquake` cases, including the Politiikka vacuity guard and the
  quake-iff-boom check.
- `src/test/invariants.test.ts`: extend the reduced-motion describe's selector and keyframes lists,
  and add the shard-path CSS-text assertion.

## Out of scope

- Sofia's rules in any mode (`rpsCompare`, `sofiaIn`, `currentWinner`), scoring, targets, the rules
  panel and the README.
- The Politiikka rampage and hit animations, and any shake in Politiikka or any other mode.
- Explosions or shakes for any other card (the ♣K, the ♣Q, ordinary losers), or for a lost match on
  `RpsOver`.
- Sound or haptics (`navigator.vibrate`).
- A player setting to turn the shake off. Reduced motion is the only switch.
- Letting fragments escape `.felt`'s `overflow:hidden` (a portal or a viewport-level layer).
- Any change to `resolveRps`'s or `showRpsOver`'s delays, or to the hair.
- Everything already delivered by `2026-09-25-sofia-rampage-and-explosion` beyond the fragment count
  and the bang's size: see that spec.
