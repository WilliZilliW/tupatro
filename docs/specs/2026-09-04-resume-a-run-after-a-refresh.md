---
id: 2026-09-04-resume-a-run-after-a-refresh
title: Persist the run to localStorage so a refresh resumes it where it left off
kind: infra
status: proposed
---

# Persist the run to localStorage so a refresh resumes it where it left off

## What

Closing the tab or reloading the page no longer throws away an eight-ante run. A new pure module
`src/game/save.ts` turns `GameState` into a JSON-safe snapshot and back: the content that carries
function references (owned jokers, consumables, the boss, and the shop stock on offer) is stored as
content **ids**, and loading rebuilds a state by starting from `createRun(seed)` and overwriting the
saved keys, rejecting the whole save on a version mismatch or an id it does not know. `game/storage.ts`
keeps being the game side's only `localStorage` site and gains the key `tupatro-run-v1`;
`GameProvider` writes the snapshot from an effect whenever `state.screen` is set, clears it on
`gameover` and `victory`, and prefers an explicit `seed` prop over any save it finds.

This is a snapshot, not an action log, and it is taken at screen boundaries only — so a reload
resumes at the last blind select, deal end, cash-out or shop, not in the middle of a trick. No
tuppi rule, no score, no balance number and no player-facing string changes.

## Acceptance criteria

- [ ] `src/game/save.ts` exists and is pure: it exports `SAVE_VERSION`, `type SavedRun`,
      `dehydrate(g: GameState): SavedRun` and `rehydrate(raw: unknown, bestAnte: number): GameState | null`,
      and imports neither React, the DOM, `localStorage`, `i18n`, `reducer` nor any component. It is
      added to `PURE_CORE` in `src/test/invariants.test.ts` and passes those cases.
- [ ] `dehydrate` replaces every function-carrying object with an id: `jokers` → `string[]`,
      `consumables` → `string[]`, `boss` → `string | null`, and each entry of `shop` → a plain
      `{ kind, price, sold }` plus an `id` (joker, consumable, voucher) or `{ s, r, enh }` (card
      offer). A test asserts `JSON.parse(JSON.stringify(dehydrate(g)))` contains no function and,
      after `rehydrate`, `g2.jokers[0]` is **identical** (`toBe`) to its `JOKERS` entry and
      `typeof g2.jokers[0].add === "function"`; the same for a joker sitting unsold in `g2.shop`.
- [ ] `rehydrate` builds from `createRun(saved.seed, bestAnte)` and overwrites only saved keys.
      A test asserts the rehydrated object's key set equals `Object.keys(createRun("X"))` and that
      no value is `undefined`, so a field added to `GameState` later cannot silently arrive missing.
- [ ] `rehydrate` returns `null` and never throws for each of: `raw` not an object; `v` absent or
      `!== SAVE_VERSION`; an unknown joker, consumable, voucher or boss id; an unknown `Enhancement`
      on a hand card, a side-deck card or a shop card offer. One test case per rejection.
- [ ] Round trip then identical play: `src/game/save.test.ts` plays a seeded run with
      `src/test/bot.ts` to a screen at which at least one joker with an `add` or `xm` effect is
      owned, does `const back = rehydrate(JSON.parse(JSON.stringify(dehydrate(s))), s.bestAnte)!`,
      and then drives **both** `s` and `back` onward with the same policy and the same actions. The
      resulting states are deep-equal and the deal scores are equal. Mutation-check it: make
      `rehydrate` return jokers as plain `{id}` objects and confirm this test fails.
- [ ] `src/game/storage.ts` holds `RUN_KEY = "tupatro-run-v1"` beside `BEST_KEY`, exports
      `readRun(): unknown | null`, `writeRun(s: SavedRun): void` and `clearRun(): void`, does the
      `JSON.parse`/`JSON.stringify`, and wraps every call in `try/catch` so a private window or a
      quota error degrades to no persistence rather than a thrown render.
- [ ] An invariants case asserts that the files under `src/game/` and `src/hooks/` containing
      `localStorage` are exactly `["src/game/storage.ts"]`, with a comment naming `src/i18n/index.ts`
      as the other, unrelated site (the locale preference), which is not moved.
- [ ] `GameProvider`'s `useReducer` initialiser, given **no** `seed` prop, returns
      `rehydrate(readRun(), readBestAnte()) ?? createRun(undefined, readBestAnte())`; given a `seed`
      prop it returns `createRun(seed, readBestAnte())` and never reads the run key. Tests in a new
      `src/hooks/GameContext.test.tsx` (a probe component calling `useGameState`): with a valid save
      for seed `SAVED` at ante 3 in `localStorage`, the probe reads seed `SAVED` and ante 3; with
      `seed="FRESH"` and that same save present, the probe reads seed `FRESH` and ante 1.
- [ ] One `useEffect` in `src/hooks/GameContext.tsx` — and no other site — calls
      `writeRun(dehydrate(state))`, guarded so it writes **only** when `state.screen` is set, and
      calls `clearRun()` instead when `state.screen.kind` is `"gameover"` or `"victory"`. Tests:
      (a) after mounting on a resumed shop screen, `localStorage["tupatro-run-v1"]` parses to
      `v === SAVE_VERSION` and the same ante; (b) after the probe dispatches `startBlind` (screen
      goes null), the stored save still reports `screen.kind === "blindselect"` — the mid-deal state
      was not written; (c) mounting on a saved `gameover` screen leaves `localStorage["tupatro-run-v1"]`
      null while the probe still shows the game-over screen.
- [ ] The docs stop saying the run is lost: `CLAUDE.md`'s module table gains a `game/save.ts` row and
      its `game/storage.ts` row mentions the run; the "No run persistence" known gap is replaced by a
      description of what is saved and the screen-boundary granularity. `README.md` gains a short
      "Saved runs" note, and the sentence "Support … is not persisted; `localStorage` still holds only
      the best ante" is corrected (support now rides along inside the run snapshot). The test counts
      in both files are updated from 282 to the new number.
- [ ] A manual browser reading, recorded in the pull request, because jsdom cannot reload a page:
      with `npm run dev`, play into ante 1's shop, buy a joker, reload the tab, and confirm the shop
      screen, the money, the seed and the joker are unchanged and that the joker still adds its
      chips/mult on the next scoring trick. Then finish a run to game over, reload, and confirm a
      new run starts.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **This contradicts one delivered line and fills a gap another one named.**
  `2026-09-03-party-emblems-and-support` states "Support is per run and is not persisted.
  `localStorage` still holds only the best ante", and `README.md` repeats it. This requirement wins:
  support is part of `GameState`, so it is saved with the run. The spirit of the earlier line is kept
  — support is still per run, still resets on a new run, still buys nothing, and is **not** persisted
  as its own key. `2026-09-03-playable-on-a-phone-screen` put run persistence out of scope as "a known
  gap"; this spec closes exactly that gap and changes nothing else it decided.
- **The shop stock is dehydrated too, though the requirement did not name it.** `g.shop` holds live
  `Joker` objects (`rollShopStock` pushes the `JOKERS` entry itself), and the shop screen is one of
  the save points. Without dehydrating the stock, a joker bought after a reload would enter `g.jokers`
  as an effect-less object and silently score nothing — the exact failure the requirement is guarding
  against, one level further out.
- **A shop card offer is rebuilt, not stored whole.** `rollCardOffer` mints an offer that is in no
  content table, so `src/game/shop.ts` gains a pure `cardOffer(s, r, enh): CardOffer` that both
  `rollCardOffer` and `rehydrate` call. The offer's key, glyph and price therefore come from `ENH` at
  load time rather than from stale save data.
- **A refresh becomes an undo for a bad deal.** Writing only when `state.screen` is set — as the
  requirement prescribes — means a reload rewinds to the last screen and, because `rngState` is part
  of the snapshot, the next deal is dealt identically. A player who reloads mid-deal replays the same
  cards knowing how they fall. This is a deliberate consequence of the prescribed write condition, not
  an oversight; a continuous autosave that would close it is out of scope.
- **`bestAnte` is not trusted from the save.** It is taken as `Math.max` of the saved value and
  `readBestAnte()`, because the two keys can disagree when another tab advanced the record.
- **`modal`, `toast`, `toastSeq` and `pop` are not saved.** They are transient view state; a resumed
  run opens with no leftover toast and no open modal, at whatever `createRun` sets.
- **`partyMap` is not saved either — it is recomputed by `createRun` from the seed**, which is a pure
  function of it today. The cost: if the party roll ever changes, an old save's emblems shift while its
  support totals do not. That is cosmetic, and it keeps one source of truth for the mapping.
- **Validation is version plus ids, and nothing deeper.** A hand-edited save with an eleven-card hand
  or a negative ante is accepted and may produce an incoherent run. A schema validator is not written;
  bumping `SAVE_VERSION` is the tool for a state-shape change.
- **The version lives in the payload, not only in the key.** The key stays `tupatro-run-v1` as
  required and never changes again; the payload carries `v: SAVE_VERSION`, and a future shape change
  bumps `SAVE_VERSION` so old saves are rejected and overwritten in place. Renaming the key instead
  would orphan bytes nothing ever cleans up.
- **Resuming is silent — no new player-facing string.** No "run resumed" toast, no "continue or new
  run?" prompt, no catalogue key, so `src/i18n/` is untouched. The visible consequence is that a
  reload no longer hands out a new seed: a fresh run comes from the rail's New game button or the seed
  dialog, both of which dispatch `newRun` and overwrite the save at the next screen.
- **Storage failures stay silent.** Private browsing, a full quota or a disabled store means the run
  lives in memory only, exactly as the best ante already does. No error UI.
- **Classified `infra`, and the check that classification would skip is written in by hand.** Nothing
  renders differently, no panel, layout or interaction changes, and no string moves, so `ui` would be
  a lie about the diff — but the one verification that matters here is a real browser reload, which
  jsdom cannot do, so it is an explicit acceptance criterion and a recorded reading in the PR instead
  of a stage.

## Touch points

- `src/game/save.ts` — **new.** `SAVE_VERSION`, `SavedRun`, `dehydrate`, `rehydrate`. Pure; added to
  `PURE_CORE` in the invariants test.
- `src/game/storage.ts` — `RUN_KEY = "tupatro-run-v1"`, `readRun`, `writeRun`, `clearRun`, each
  `try/catch`ed. Stays the game side's only `localStorage` site.
- `src/game/shop.ts` — `rollCardOffer` split so a pure `cardOffer(s, r, enh)` builds the offer;
  `rollShopStock` unchanged in behaviour and in what it consumes from the `Rng`.
- `src/game/state.ts` — unchanged, but `createRun` is the base every rehydrate starts from; do not
  make it read storage.
- `src/hooks/GameContext.tsx` — the `useReducer` initialiser prefers the `seed` prop, else a save,
  else a fresh run; one new effect writes on `state.screen` and clears on `gameover` / `victory`. The
  existing `writeBestAnte` effect stays as it is.
- `src/game/save.test.ts` — **new.** Dehydrate/rehydrate identity, every rejection case, and the
  bot round-trip that advances identically.
- `src/hooks/GameContext.test.tsx` — **new.** A probe component over the real `GameProvider`: resume,
  seed-prop precedence, write-on-screen-only, clear on game over.
- `src/test/invariants.test.ts` — `src/game/save.ts` added to `PURE_CORE`; a case pinning the
  `localStorage` sites under `src/game/` and `src/hooks/` to `storage.ts` alone.
- `README.md` — a "Saved runs" note; the support sentence at the end of "Parties and support"
  corrected; test count.
- `CLAUDE.md` — module table row for `game/save.ts`, storage row amended, the "No run persistence"
  known gap rewritten, test count.

## Out of scope

- Continuous autosave, per-trick saving or an action log — and therefore closing the
  reload-as-undo consequence described above.
- Migrating saves across a `SAVE_VERSION` bump: an old save is discarded, not upgraded.
- Multiple save slots, naming a save, exporting or importing one, and any cloud or cross-device sync.
- Any "continue / new run" prompt, resume toast, save indicator or other new player-facing text.
- Moving `src/i18n/index.ts`'s locale key into `storage.ts`, or changing how the best ante is stored.
- Changing any tuppi rule, the scoring order, a balance number, the shop roll or the `Rng` — the
  snapshot must reproduce today's behaviour exactly, not adjust it.
- Adding a `buy` member to `Policy` in `src/test/bot.ts`: the round-trip test dispatches shop actions
  directly through `act`.
- Compression, IndexedDB, or a storage-event listener that syncs two open tabs.
- An error boundary or any UI for a corrupt save beyond falling back to a fresh run.

## Source

Not a rule or scoring change: no tuppi rule is read, reinterpreted or altered here. The Oulunsalo
senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>
describe the deal, the näyttö, rami/nolo, ryöstö and sooli, and say nothing about interrupting a game
and taking it up again later — a saved snapshot restores a position those rules already allow, and
the same seed and the same decisions still produce the same run.
