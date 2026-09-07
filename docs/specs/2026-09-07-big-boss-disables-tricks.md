---
id: 2026-09-07-big-boss-disables-tricks
title: Add a big boss that shuts the tricks (consumables) for its whole blind
kind: rule
status: proposed
source: Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022); https://korttipeliopas.fi/tuppi — neither knows of consumables at all, so this boss touches Balatro's shell only and changes no tuppi rule
---

# Add a big boss that shuts the tricks (consumables) for its whole blind

## What

The big boss pool gains a sixth entry, `temppukielto` ("Trick Ban"): while it is the blind's boss,
the player's one-shot tricks — the consumables, which the catalogues call _temput_ / "Tricks" —
cannot be used. The player still owns them, still buys them and still keeps them after the blind;
they simply do not fire during those four deals, so a hand that was going to be rescued by
`uusijako` or flipped by `kannanvaihto` has to be played as dealt. It is the consumable-side
mirror of `harmaus`, which shuts the side deck the same way.

## Acceptance criteria

- [ ] `src/game/content.ts`: `BIG_BOSSES` gains `{id:"temppukielto", key:"boss.temppukielto"}` as
      its sixth row and `BOSSES` stays `[...SMALL_BOSSES, ...BIG_BOSSES]`. `src/game/rules.test.ts`
      reads `toHaveLength(12)` twice (rows and unique ids), keeps asserting the two pools are
      disjoint, and lists `temppukielto` last in its `BIG_BOSSES` id array.
- [ ] **The reducer is the authority.** `useConsumable` in `src/game/reducer.ts` refuses under the
      boss: a guard sitting immediately after `if (!c) return;` and **before** the `d.phase !==
"play"` guard, which toasts `{ key: "toast.tricksBanned" }` and returns without splicing
      `d.consumables`. A comment says why the guard is first — the player is told about the boss
      rather than about the phase.
- [ ] `src/game/reducer.test.ts`: dispatching `{ type: "useConsumable", index: 0 }` under
      `boss: { id: "temppukielto", key: "boss.temppukielto" }` in `phase: "play"` leaves
      `g.consumables` identical (same length, same ids) and sets `g.toast?.key` to
      `"toast.tricksBanned"`; the same dispatch in a non-`play` phase toasts
      `"toast.tricksBanned"` too, not `"toast.waitForDeal"`.
- [ ] Every consumable is refused, not only the ones with existing guards: a test loops all five
      `CONSUMABLES` ids, dispatches each under the boss in `phase: "play"`, and asserts for each
      that the item is still held and that `g.reveal`, `g.steal` and `g.mode` are unchanged from
      before the dispatch.
- [ ] The boss binds the deals, not the shop. A test with `boss.id === "temppukielto"` on the
      `shop` screen buys a `consumable` offer and asserts it lands in `g.consumables`; `g.consSlots`
      is untouched by the boss anywhere in `src/`, verified by there being no `temppukielto`
      reference outside the `useConsumable` guard, the `content.ts` row and `ConsumablesBox.tsx`.
- [ ] Nothing armed earlier leaks into the boss's deals: a test sets `reveal: true, steal: true`,
      runs `startBlind` with the boss, and asserts both are `false` (the reset `startDeal` already
      does — the test pins it so a future refactor cannot open a back door into the boss).
- [ ] `src/components/rail/ConsumablesBox.tsx`: with the boss set, every `.consbtn` carries
      `disabled` and the box renders `t("rail.tricksBanned")`; with `boss: null` no `.consbtn` is
      disabled and that string is absent. Both directions asserted in `src/test/render.test.tsx`.
- [ ] Both catalogues carry `boss.temppukielto.n`, `boss.temppukielto.t`, `toast.tricksBanned` and
      `rail.tricksBanned`, added to `fi.ts` first, with identical placeholder sets (none is
      expected to need a placeholder). `src/i18n/i18n.test.ts`'s `BOSSES` walk resolves the new row
      in both locales, and `render.test.tsx`'s `names the boss %s` sweep — whose `loadedState`
      holds two consumables, so it draws the disabled box as well as the plate — passes for
      `temppukielto` in both locales with no leaked key and no Finnish word in English output.
- [ ] `src/game/save.test.ts`: a state with `boss: { id: "temppukielto", … }` dehydrates to the id
      and rehydrates to the same `BOSSES` row. `SAVE_VERSION` stays `1`; a save written before this
      spec cannot name an id that did not exist, so there is nothing to migrate.
- [ ] `README.md`: the "Two bosses to an ante" bullet reads **six** harsh ones for the big boss
      blind, and the per-boss balance table gains a `Trick Ban (temppukielto)` row. The whole
      Balance section is re-measured over 600 seeded runs (`SEED0`…`SEED599`) of `basicPolicy`, with
      the run and blind counts restated, because a new row in `BIG_BOSSES` changes what every seed
      draws.
- [ ] `README.md` states in prose that `basicPolicy` buys nothing, so the Trick Ban row measures
      the reshuffle and not the boss — its own effect is **unmeasured**, the same caveat Grey Spell
      already carries. Without that sentence the table implies a tuned number.
- [ ] The rules panel needs no new text: `src/components/screens/Rules.tsx` and the `rules.*` keys
      enumerate no individual boss (a grep for `boss.` in that file returns nothing), and the boss's
      name and note reach the player through `BlindPlate` alone. `CLAUDE.md`'s two test counts are
      updated to the new number.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`. A mutation
      check is run and recorded in the PR body: deleting the `useConsumable` boss guard must fail a
      test.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Temput" means the consumables, not the tricks of a tuppi deal.** The catalogues name the
  one-shot items _temput_ / "Tricks" (`rail.tricksHeader`, `shop.trick`, `voucher.muistikirja.t`),
  while a played trick is a _tikki_. A boss that disabled tuppi's tricks would disable the game, so
  the consumables are the only coherent reading.
- **The boss blocks _using_ a consumable and nothing else.** It does not destroy them, refund them,
  reduce `consSlots`, block buying one in the shop, or block the replace picker. Note that `d.boss`
  is still set while the shop after the big boss blind is open (`verokarhu` reads it at cash-out),
  so a guard placed in `buy` would leak the boss into that shop — hence the guard is in
  `useConsumable` only.
- **The refusal is a toast, and the buttons are disabled as well.** The reducer's guard is the rule
  and stays reachable in tests even though the disabled buttons stop the UI from dispatching —
  the same arrangement as `toast.noSwapsLeft` / `toast.swapNoMatch`, which CLAUDE.md keeps
  deliberately.
- **Id and names are chosen here.** `temppukielto` follows `patakielto` ("Spade Ban"), the existing
  `<thing>kielto` naming, and the English name is "Trick Ban". If the reviewer wants a less literal
  name, only two catalogue rows and one id change.
- **It goes in `BIG_BOSSES`, as asked.** No mild variant is added, and the big pool becomes six
  entries against the mild pool's six.
- **A player holding no consumables feels nothing.** The boss can therefore land as a free blind,
  exactly as `harmaus` does for a player with an empty side deck. This is accepted rather than
  compensated: no substitute penalty is added.
- **Classified `rule`, not `balance`.** It ships a numberless content row, but consumables bend
  rules mid-deal (`kannanvaihto` flips rami to nolo, `tikkivarkaus` steals a trick), so removing
  them changes what a player may legally do in a deal. `rule` also runs the most verification.
- **The balance re-measurement will not measure this boss.** `basicPolicy` buys nothing, so its
  Trick Ban row is the reshuffle only. Writing a consumable-buying policy is the only honest way to
  measure it and is out of scope; the README says so instead of implying otherwise.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/game/content.ts` — one row in `BIG_BOSSES`; `BOSSES` unchanged as the concatenation.
- `src/game/reducer.ts` — `useConsumable`: the boss guard and its `why` comment.
- `src/components/rail/ConsumablesBox.tsx` — read `boss` from `useGameState()`, `disabled` on each
  `.consbtn`, one `t("rail.tricksBanned")` line.
- `src/i18n/fi.ts` — `boss.temppukielto.n`/`.t`, `toast.tricksBanned`, `rail.tricksBanned`.
- `src/i18n/en.ts` — the same four keys; it will not compile until it has them.
- `src/game/rules.test.ts` — the boss pool test: 12 rows, and `temppukielto` in the `BIG_BOSSES`
  list.
- `src/game/reducer.test.ts` — the refusal in `play` and outside it, all five consumables, the
  shop purchase under the boss, the `reveal`/`steal` reset.
- `src/game/save.test.ts` — the boss round trip through `dehydrate`/`rehydrate`.
- `src/test/render.test.tsx` — the disabled-box assertions; the `BOSSES`-keyed name sweep picks the
  new row up on its own.
- `README.md` — the pool count, the per-boss table, the re-measured Balance section and its caveat.
- `CLAUDE.md` — the test count in two places.

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- **A consumable-buying policy for `src/test/bot.ts`.** Needed to measure this boss's real cost,
  and a job of its own; `basicPolicy` stays a bot that buys nothing.
- **Any change to what a consumable does, to `consSlots`, or to the shop.** The discard picker's
  contract stands as delivered — see `docs/specs/2026-09-06-discard-picker-when-storage-full.md`,
  which already put "using a consumable from the shop" out of scope.
- **A mild counterpart in `SMALL_BOSSES`.** One row, one pool.
- **Re-tuning `ANTES` or `BLIND_MULT`.** The section is re-measured; the ladder is not moved. The
  ten-ante ladder stays as `docs/specs/2026-09-04-ten-antes-and-two-boss-blinds.md` set it — this
  spec only extends the big pool that spec created, and contradicts nothing in it beyond that pool's
  size.
- **Boss text in the rules panel.** The panel describes bosses generically and lists none; adding an
  enumeration would need its own spec.
- **Disabling jokers, vouchers or the side deck.** `harmaus` already owns the side deck; jokers and
  vouchers stay untouched.

## Source

Rule and scoring changes only. Which source was checked, and what it says. Where a rule is open to
interpretation, state the chosen reading — it also belongs in a code comment.

- Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022): describes the deal, the
  rami/nolo declaration, maantuntopakko, sooli, ryöstö and the 52-point match. It knows nothing of
  one-shot items a player may spend during a deal — there is no such thing in tuppi.
- <https://korttipeliopas.fi/tuppi>: checked on 7 September 2026. The declaration ends the moment
  someone shows rami; nolo scores from six tricks dodged, rami from seven won, ryöstö doubles and a
  clean sooli is 24. **No consumables, power-ups or mid-deal rule changers of any kind.**
- Chosen reading, and it belongs in the comment on the new `content.ts` row: the consumables are
  Balatro's shell, not tuppi, so a boss that shuts them takes nothing away from the Finnish game —
  every card, every follow-suit obligation and every point in the boss's blind is played by exactly
  the rules of the sources above. That is why this spec cites them to say the rules are _unchanged_,
  and why the boss lives in `content.ts` plus one reducer guard rather than anywhere near
  `rules.ts`.
