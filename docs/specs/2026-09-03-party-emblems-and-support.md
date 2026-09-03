---
id: 2026-09-03-party-emblems-and-support
title: Give every card a party emblem and tally the support that collected tricks bring in
kind: ui
status: proposed
---

# Give every card a party emblem and tally the support that collected tricks bring in

## What

Every card in the deck carries a party emblem alongside its suit and rank, and the emblem is not
a function of the suit: the 52 cards split evenly over 13 parties, four cards each, exactly one
card per suit per party. The player can read a card's party off its face, in hand, on the felt and
in the tuppipakka. Every trick the player's own side collects also collects support for the
parties of the four cards in it, and the running support of each party is visible in the left
rail for the whole run.

Support is a counter only. It does not touch chips, mult, money, the shop or any tuppi rule in
this spec.

## Acceptance criteria

- [ ] `src/game/content.ts` exports `PARTIES` with exactly **13** entries and `PARTY_IDS` derived
      from it. A test asserts: 13 entries, unique `id`s, and every `g` (the emblem) is 1–2
      characters matching `/^[A-Z0-9]{1,2}$/` — letters and digits only, so the tofu law is
      satisfied by construction rather than by a glyph test.
- [ ] `GameState` gains `partyMap: Record<string, string>` (card type `id` → party `id`) and
      `support: Record<string, number>`. Both are initialised in `createRun`, so the existing
      `invariants.test.ts` case "defines every state field in createRun" passes unchanged.
- [ ] A test asserts the even split on a named seed: `partyMap` has all **52** card `id`s as keys,
      every party `id` appears exactly **4** times, and within each of the four suits every party
      `id` appears exactly **once**.
- [ ] A test asserts the emblem is not derivable from rank either: for seed `"PUOLUE"` there is at
      least one rank whose four cards do not all share a party.
- [ ] A test asserts determinism: `createRun("PUOLUE").partyMap` deep-equals a second
      `createRun("PUOLUE").partyMap`, and `createRun("PUOLUE").partyMap` differs from
      `createRun("TOINEN").partyMap`. No new `Math.random` call site — `invariants.test.ts` keeps
      passing.
- [ ] `partyOf(g, c)` exists in `src/game/cards.ts`, takes state as a parameter, and resolves the
      party from the card **type**. A test asserts `partyOf(g, card("S", 14))` equals
      `partyOf(g, card("S", 14, "steel"))`, so a side-deck card and the hand card it swaps for
      always show the same party. `Card` gains no new field; `sameFace` and every `uid` comparison
      are untouched.
- [ ] `src/components/PlayingCard.tsx` renders the emblem on **both** branches, unconditionally —
      the `twin` gate stays on the suit and rank only. A render test asserts the emblem is present
      for an ordinary card, for a stone card in the tuppipakka and for a stone card on the felt,
      and that the felt stone card still prints no `.twin` pair.
- [ ] A reducer test plays one trick that the player's side wins and asserts that `support` gains
      exactly **+4** in total, distributed as +1 to the party of each of the four cards played
      (so +2 to one party if two of the cards share it).
- [ ] A reducer test asserts a trick won by the opponents leaves `support` completely unchanged.
- [ ] A reducer test asserts `support` survives `startDeal` — it accumulates across the deals of a
      blind and across blinds — and is back to all-zero after `newRun`. The across-blinds half
      dispatches `nextBlind` / `skipBlind` and then `startBlind`, and crosses an ante boundary too,
      so a reset added next to `d.blindScore = 0` fails a test.
- [ ] A test asserts support cannot move the score: `scoreTrick` called on two states that differ
      only in `support` returns the same `total`, `chips`, `mult` and `payout`.
- [ ] A test asserts no invented party is a real one: no `party.*.n` value in `fi.ts` or `en.ts`
      case-insensitively matches any entry of a blocklist of real Finnish parties and their
      abbreviations (at minimum SDP, Kokoomus/KOK, Perussuomalaiset/PS, Keskusta/KESK,
      Vihreät/VIHR, Vasemmistoliitto/VAS, RKP, KD, Liike Nyt), and no `g` emblem equals one of
      those abbreviations.
- [ ] A new rail plate `src/components/rail/SupportBox.tsx` is rendered by
      `src/components/rail/Rail.tsx` and shows all 13 parties in fixed `PARTIES` order — emblem
      plus count — with counts through `fmt()` and every label through `t()` / `nameOf()`.
- [ ] `src/test/render.test.tsx` covers the new plate in both languages and stays green: no
      `undefined`, no `[object Object]`, no `NaN`, no leaked catalogue key, no Finnish stopword in
      English output.
- [ ] `src/i18n/i18n.test.ts`'s data-row case includes `PARTIES`, so a party missing its `.n` in
      either catalogue fails a test rather than printing `undefined`.
- [ ] `src/components/screens/Rules.tsx` gains a parties section that states the 13×4 split and
      that collected tricks bring in support, drawn from catalogue keys (`rules.partiesTitle`,
      `rules.parties`).
- [ ] `README.md` documents party emblems and support under a section of their own, including the
      13 parties × 4 cards × one per suit split. No figure in the Balance section changes, because
      nothing scoring-related changes.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **There are 13 parties, not 4.** "Jakautuu tasan 52 kortin ja 4 maan kanssa" is read strictly:
  the party count `p` must divide 52 **and** divide the 13 cards of each suit. Only `p = 1` and
  `p = 13` do. Four parties would give 13 cards each but 3.25 per suit, so the four-party reading
  is arithmetically impossible under an even per-suit split and is deliberately rejected. If the
  user meant four parties with an uneven per-suit split (3/3/3/4), this spec is wrong in its
  central number.
- **13 parties means 13 names, 13 emblems and 13 rail rows.** That is a lot of new content and a
  crowded rail. Accepted rather than reduced, because reducing the count breaks the even split.
- **Each party holds exactly one card of each suit.** That is forced by the previous two
  assumptions, and it is the reading that makes "riippumatta kortin maasta" true: knowing the suit
  tells you nothing about the party.
- **The assignment is rolled once per run from the seed and then fixed.** Not hardcoded globally,
  and not rerolled per deal — a mapping that changed between deals would be unreadable, and a
  fixed global mapping would make the emblem memorisable and therefore free information. Same seed
  → same mapping, like the deals and the shop.
- **The party is independent of rank as well as suit.** Each suit gets its own permutation of the
  13 parties, so "all aces are party X" is not the case. A party-equals-rank mapping would satisfy
  the letter of the requirement while carrying no information.
- **`Card` gains no field.** The party is derived from the card type (suit + rank) through
  `g.partyMap`. This is how a side-deck twin, a shop offer and a dealt card end up agreeing
  without any minting change, and it keeps the `uid`-is-identity law untouched. `partyOf` keys the
  lookup off `c.s` and `c.r` rather than off `c.id`, and takes `Pick<Card, "s" | "r">`, so a
  card-shaped value carrying no `id` — a shop offer's `card` is `{ s, r, enh }` — resolves to its
  own party. There is deliberately **no fallback**: a default party would misattribute support and
  print a wrong emblem, so the return type is `string | undefined` and each caller decides — the
  card prints no emblem, and the reducer credits nobody.

- **A stone card carries its emblem everywhere, the felt included.** The `twin` gate stays where
  CLAUDE.md put it, on the suit and rank, and its stated reason — "on the felt it would read as a
  card that could follow suit" — does not reach the emblem, because a party is not a suit and
  nothing can be followed with it. Nor is there concealment to protect: enhancements never enter
  the base deck, so every stone card on the felt is one the player chose in the tuppipakka, where
  its pair and its emblem are both already printed, and no opponent reads a party at all.
- **"Kerätyt tikit" is read as tricks the player's side _wins_** (`isUs(winSeat)`), not tricks
  that _score_. Those differ: in nolo and sooli the game scores the tricks you dodge. Consequence
  the reviewer should weigh: in a nolo deal the player collects almost no support, and a bad nolo
  collects a lot. If the intent was "every trick that scores", this is the wrong hook and the fix
  is one condition in `resolveTrick`.
- **All four cards of a collected trick grant +1 each to their party** — not just the winning card,
  and not weighted by chips or rank. Total support in a full deal is therefore 4 × the tricks the
  player's side took.
- **Tricks the opponents collect grant nothing to anyone.** No rival tally is kept for the
  opposing pair, because the requirement is written from the player's side.
- **Support does nothing yet.** No score, no money, no joker, voucher, boss or shop interaction,
  no unlock. The requirement says tricks collect support; it does not say what support buys.
  Anything further would be invented balance, which this project forbids. This is the single
  biggest scope decision here: if the user expected support to _do_ something, that is a
  `scoring` or `balance` spec of its own on top of this one.
- **The rail plate keeps a fixed order** (the `PARTIES` order), with zero counts shown muted. A
  list sorted by support would reorder itself mid-deal and be unreadable.
- **The plate goes last in the rail, not after `Tally`.** Thirteen read-only rows above the
  consumable buttons would push every control in the rail down by their own height on a short
  window, which is the failure CLAUDE.md records as having shipped twice. Nothing on the plate is a
  decision, so it loses nothing by sitting at the bottom.
- **Support is per run and is not persisted.** `localStorage` still holds only the best ante.
- **Party names are invented and apolitical, and localised like joker names** (`party.<id>.n` in
  both catalogues, reached through `nameOf`). Real Finnish parties are deliberately not used: the
  game would then be putting words in a real organisation's mouth. The tuppi terms stay Finnish,
  but a party name is invented content, not a tuppi term, so it is translated.
- **Emblems are 1–2 uppercase letters or digits**, in the spirit of the letter codes on a Finnish
  ballot, and chosen this way so no exotic glyph can render as tofu on the tiny card corner.
- **Classified `ui`.** No tuppi rule changes (follow-suit, trick winner, declaration, sooli are
  untouched) and no chips × mult computation changes, so neither `rule` nor `scoring` fits, and no
  existing number is retuned, so not `balance`. It is new visible information plus a visible
  counter. The consequence is that the balance verification stage does not run — which is correct
  only for as long as support stays inert.

## Touch points

- `src/game/types.ts` — a `Party` shape (`{ id, key, g }`), `GameState.partyMap`,
  `GameState.support`
- `src/game/content.ts` — `PARTIES` and `PARTY_IDS`, as data with no logic, `// prettier-ignore`
  on the compact table the way `ENH` and `JOKERS` are
- `src/game/cards.ts` — `partyOf(g, c)`, taking state as a parameter next to `chipValue` and
  `enhOf`
- `src/game/state.ts` — `createRun` rolls `partyMap` (four seeded permutations of `PARTY_IDS`, one
  per suit, through `makeRng`/`shuffle` from `rng.ts`) and zeroes `support`
- `src/game/reducer.ts` — `resolveTrick`: after `d.winSeat = w.p`, add +1 per card's party to
  `d.support` when `isUs(w.p)`; `startDeal` must **not** reset it; `newRun` already resets through
  `createRun`
- `src/components/PlayingCard.tsx` — the emblem on both branches, outside the `twin` gate
- `src/components/rail/SupportBox.tsx` (new) and `src/components/rail/Rail.tsx` — the plate,
  placed last, after `ConsumablesBox`
- `src/index.css` — hand-formatted, excluded from Prettier: classes for the card-corner emblem and
  the support plate
- `src/i18n/fi.ts` then `src/i18n/en.ts` — `party.<id>.n` × 13, `rail.support`,
  `rules.partiesTitle`, `rules.parties`
- `src/components/screens/Rules.tsx` — the parties section, through `tList`
- `README.md` — a party section; the Balance table is untouched
- `src/game/rules.test.ts`, `src/game/reducer.test.ts`, `src/i18n/i18n.test.ts`,
  `src/test/render.test.tsx` — the assertions above
- `src/test/factories.ts` — expected to need **no** change: `st()` builds on `createRun`, so the
  new fields arrive with it

## Out of scope

- Anything support _buys_: score, money, jokers, vouchers, consumables, shop discounts, unlocks,
  ante thresholds. Support is a counter in this spec.
- Party-flavoured content: no joker keyed to a party, no boss that bans one, no per-party
  enhancement.
- Opponent or per-pair support tallies, and any AI behaviour that reads a party.
- Persisting support or the party mapping across runs or to `localStorage`.
- Retuning `ANTES` or any balance figure, and re-running the balance simulation — nothing scoring
  related moves.
- Reordering, filtering or sorting the hand by party, and any party column in the tuppipakka
  beyond the emblem the card face already gains.
- Accessibility semantics for the new emblem and plate, which stay in the project's known gaps.

## Source

Not a rule or scoring change, so no tuppi rule is being reinterpreted — recorded here because the
requirement adds something tuppi does not have.

- Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022): describes suits, ranks,
  the näyttö, rami/nolo, ryöstö and sooli. It has **no** concept of a party marker on a card and
  no per-trick tally beyond the trick counts themselves, so nothing here contradicts it: parties
  are Balatro-side content laid over an unchanged tuppi deck, the way enhancements are.
- <https://korttipeliopas.fi/tuppi>: likewise silent on any card attribute besides suit and rank.
- Chosen reading, to be repeated as a code comment on `partyMap` in `state.ts`: the even split the
  requirement asks for is only possible with 13 parties of four cards, one per suit, because the
  party count has to divide both 52 and the 13 cards of a suit.
