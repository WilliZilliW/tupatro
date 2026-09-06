---
id: 2026-09-06-start-menu-with-continue-and-challenges
title: Boot to a start menu with Continue, New Game and an empty Challenges list
kind: ui
status: proposed
---

# Boot to a start menu with Continue, New Game and an empty Challenges list

## What

The game opens on a start menu instead of dropping the player straight onto a table. The menu
offers **Continue** — shown only when there is a run to return to, which at boot means a saved run
was found and loaded — **New Game**, which asks for confirmation first whenever Continue is on
offer, and **Challenges**, a list of alternate rule sets that is empty in this change and says so.
Rules and SCORES open from the menu itself and close back to it. The rail's **New game** button no
longer starts a run on the spot: it raises the same menu, from which Continue returns to the run
untouched.

No tuppi rule, no score, no balance number and no ante threshold changes. No challenge is
implemented: the view and its empty state exist so that a later spec has somewhere to put one.

## Acceptance criteria

- [ ] `GameState` gains two fields and `createRun` initialises both in its `// prettier-ignore`
      literal, so the "every field in the type is initialised" test keeps passing: `menu` at `null`
      (its type is `MenuView | null`, and `export type MenuView = "start" | "challenges"` is added to
      `src/game/types.ts`) and `runStarted: boolean` at `false`. `src/components/screens/Screens.tsx` draws in the order
      **modal → menu → screen**, so Rules or SCORES opened over the menu closes back to the menu
      and not into the run underneath. A test renders `<Screens />` with
      `loadedState({ menu: "start", modal: "rules" })` and finds the rules panel, and with
      `loadedState({ menu: "start", screen: { kind: "shop" }, shop: SHOP })` finds the menu and no
      shop.
- [ ] Boot lands on the menu. `initialState` in `src/hooks/GameContext.tsx`, given **no** `seed`
      prop, returns the state it returns today (`rehydrate(readRun(), …) ?? createRun(…)`) with
      `menu: "start"`; given a `seed` prop it returns `{ ...createRun(seed, best), runStarted: true }`
      with `menu` left `null`, because an explicit seed is a run the player already chose. Tests in
      `src/hooks/GameContext.test.tsx` (probe reading `g.menu`/`g.runStarted`): with the existing
      `SAVED` save, seed `SAVED`, ante `3`, `menu === "start"`, `runStarted === true`; with no save,
      `menu === "start"` and `runStarted === false`; with `seed="FRESH"`, `menu === null`.
- [ ] `src/components/screens/Menu.tsx` renders through `Overlay` and holds, in this DOM order:
      Continue (`btn.continue`, rendered **only** when `g.runStarted`), New Game (`btn.newGame`),
      Challenges (`btn.challenges`), Rules (`btn.rules`) and SCORES (`btn.scores`). Tests with
      `renderWith`: with `runStarted: true` five buttons render and clicking Continue dispatches
      exactly `{ type: "closeMenu" }`; with `runStarted: false` four render and no button's
      `textContent` equals `translate(locale, "btn.continue")` in either locale; Rules dispatches
      `{ type: "openModal", modal: "rules" }` and SCORES `{ type: "openModal", modal: "scores" }`.
- [ ] New Game confirms exactly when Continue is offered. From `Menu`, with `runStarted: false` the
      New Game button dispatches `{ type: "newRun" }` and nothing else; with `runStarted: true` it
      dispatches `{ type: "openModal", modal: "restart" }` and never `newRun`. `RestartConfirm`
      keeps `restart.title`/`restart.body` and its confirm (`btn.yesRestart` → `newRun`), and its
      ghost button's key changes from `btn.continue` to the existing `btn.cancel`: the modal is now
      reachable only from the menu, where cancelling returns to the menu rather than to the run, so
      "Jatka" would be false. Tests assert both dispatches and the cancel label.
- [ ] `src/game/actions.ts` gains exactly `{ type: "showMenu"; view: MenuView }` and
      `{ type: "closeMenu" }`; the reducer's two cases set and clear `d.menu` and touch no other
      field. `newRun` returns `{ ...createRun(action.seed, d.bestAnte), runStarted: true }`, so a run
      started from the menu leaves the menu (`createRun` has `menu: null`) and shows Continue when
      the menu is reopened. `reducer.test.ts` asserts: `showMenu` from a mid-deal state sets
      `menu === "start"` and leaves `phase`, `hands` and `trick` untouched; `closeMenu` sets it back
      to `null`; `newRun` from `{ menu: "start" }` yields `menu === null` and `runStarted === true`.
- [ ] The rail always routes through the menu. `Rail.tsx`'s New game button dispatches
      `{ type: "showMenu", view: "start" }` unconditionally — the `phase === "play" && trickNo > 0`
      conditional and its direct `newRun` are gone — and a test clicking it from a mid-deal
      `loadedState()` asserts that action and no `newRun`.
- [ ] The clock stops while the menu is up. `nextTick` in `src/game/schedule.ts` returns `null`
      whenever `g.menu !== null`, with a comment saying why: the rail can raise the menu mid-deal,
      where `g.screen` is `null`, and the opponents must not play on behind it. A test beside the
      existing `nextTick` case in `reducer.test.ts` takes a state whose `nextTick` is non-null (an
      opponent to play) and asserts it is `null` with `menu: "start"`. Mutation-check it: delete the
      guard and confirm that test fails.
- [ ] `src/components/screens/Challenges.tsx` renders through `Overlay` with `challenges.title`, an
      empty-state line `challenges.empty` saying no challenges exist yet, **zero** list rows, and one
      Back button (`btn.back`) dispatching `{ type: "showMenu", view: "start" }`. No `Challenge`
      type, no content table, no `GameState` field and no rule switch is added: a search for
      `Challenge` under `src/game/` finds nothing.
- [ ] The save carries the new fields correctly and `SAVE_VERSION` stays `1`. `"menu"` joins
      `Dropped` and `DROPPED_KEYS` in `src/game/save.ts` beside `modal`; `runStarted` rides along in
      the rest-spread and `rehydrate` returns `runStarted: rest.runStarted ?? true`, so a save
      written before this change resumes with Continue offered. `save.test.ts` asserts: a dehydrated
      snapshot has no `menu` key; `rehydrate` of a snapshot with `runStarted` deleted yields `true`;
      `rehydrate` of one carrying `false` yields `false`; and the delivered round-trip
      deep-equality and identical-play cases still pass unchanged.
- [ ] No snapshot is written while the menu is up. The effect in `GameContext.tsx` keeps its
      `gameover`/`victory` branch first (a resumed end screen still calls `clearRun()` and files its
      row) and returns before `writeRun` when `state.menu !== null`. **This narrows a delivered
      criterion of `2026-09-04-resume-a-run-after-a-refresh`** — "writes only when `state.screen` is
      set" becomes "…and the start menu is not up" — so its test "saves the run it resumed onto a
      shop screen" dispatches `closeMenu` first and then asserts the same snapshot. A new test:
      booting with **no** save leaves `localStorage["tupatro-run-v1"]` `null` while the menu is up,
      and after `newRun` a snapshot appears.
- [ ] New keys, and only these, added to `src/i18n/fi.ts` first and then `en.ts`: `menu.title`,
      `menu.dek`, `btn.challenges`, `challenges.title`, `challenges.empty`. Continue, New game,
      Rules, SCORES, Back and Cancel reuse `btn.continue`, `btn.newGame`, `btn.rules`, `btn.scores`,
      `btn.back`, `btn.cancel`. The `VIEWS` sweep in `src/test/render.test.tsx` gains three entries —
      `menu: "start"` with `runStarted: true`, the same with `runStarted: false`, and
      `menu: "challenges"` — so all three render in both languages with no `undefined`, no
      `[object Object]`, no leaked key and no Finnish in English output.
- [ ] The documents stop describing a game that boots into a run. `CLAUDE.md`: the "Overlays are
      state, not calls" paragraph names the third field and the modal → menu → screen order; the
      known-gaps persistence bullet records the menu-up write guard and the `runStarted ?? true`
      default; the `components/screens/*` row mentions the menu. `README.md`: a short paragraph under
      **Playing it** describing the menu's three choices, and the **Saved runs** section says a
      visit lands on the menu and Continue resumes. Test counts in `CLAUDE.md` and `README.md` are
      updated if `npm test` prints a number other than 508.
- [ ] Gates green — `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build` — and one
      browser reading recorded in the pull request, because jsdom lays nothing out: with
      `npm run dev` at **1280x800** and **390x844**, on cleared storage the menu shows four buttons
      with no Continue and no page scroll; after New Game, playing to the shop and reloading, the
      menu shows Continue and clicking it lands back on the shop with the same money and jokers.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- The menu is a **third view field** (`g.menu`), not a `Screen` kind and not a `Modal`. A `Screen`
  kind would overwrite the resumed run's own screen — a save resumed onto the shop has
  `screen: { kind: "shop" }`, and Continue could not put it back — and a `Modal` would be dismissed
  by the Rules panel's own close button, dropping the player into a run they never chose. The cost
  is real: the compiler-bound `SCREENS` fixture in `render.test.tsx` is keyed off `Screen["kind"]`
  and therefore does **not** cover the menu, so the "every overlay carries a way to the board" rule
  is held here by hand-written tests only.
- Continue does not re-read `localStorage`. The delivered boot path already rehydrates the save into
  the store, so Continue only lowers the menu (`closeMenu`). Its visibility is therefore
  `g.runStarted` and not "the run key is present": a run started this session stays continuable in a
  private window where storage throws, and a corrupt save can never produce a Continue that leads
  nowhere, because the boot rehydrate already discarded it.
- "New Game asks for confirmation when a save would be discarded" is read as **exactly when Continue
  is offered** (`g.runStarted`). Mid-deal from the rail this preserves today's confirmation; at a
  fresh boot with no save, New Game starts at once with no dialog.
- The confirmation is the existing `restart` modal with its existing Finnish and English copy, not a
  new menu-specific dialog. Only its ghost button's key changes, to `btn.cancel`.
- The rail's New game opens the menu in **every** state, including mid-trick. That deliberately
  reverses the sentence in `2026-09-04-resume-a-run-after-a-refresh` that "a fresh run comes from the
  rail's New game button or the seed dialog, both of which dispatch `newRun`": the rail now
  dispatches `showMenu` and only the menu dispatches `newRun`. The seed dialog is untouched and
  still dispatches `newRun` directly, so entering a seed still bypasses the menu.
- `GameOver` and `Victory` keep their own New game and Replay seed buttons and do **not** route
  through the menu. The requirement names the rail's button only, and those runs are already over —
  nothing would be discarded.
- Challenges ships as markup plus two catalogue keys. No `Challenge` type, table, id, unlock or
  selection field is added, because none of it could be tested against a real challenge; a later
  spec adds all of it at once.
- The Challenges view carries Back only, no SCORES button. The board is two clicks away (Back, then
  SCORES on the menu), so the project's "an overlay must not hide the board" rule is met
  transitively rather than directly. A reviewer who disagrees should ask for a `ScoresButton` there.
- `SAVE_VERSION` is **not** bumped. `runStarted` is added to the snapshot and read as `?? true`,
  which is the right answer for every save written before this change (they are all real runs), and
  `menu` is dropped from the snapshot entirely. Nothing else in the shape moves.
- With an explicit `seed` prop on `GameProvider` no menu is shown. `main.tsx` does not pass that
  prop today; only tests do.
- The board behind the menu is not hidden or restyled — the felt, hand and rail render underneath as
  they do behind any `.overlay`. At a fresh boot that is an empty ante-1 table, visible through
  whatever the overlay's backdrop already is.
- No focus is moved to Continue and no ARIA is added; accessibility stays the documented known gap.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/game/types.ts` — `MenuView`; `GameState.menu`, `GameState.runStarted`
- `src/game/state.ts` — `createRun`'s literal gains `menu: null`, `runStarted: false`
- `src/game/actions.ts` — `showMenu`, `closeMenu`
- `src/game/reducer.ts` — the two new cases; `newRun` sets `runStarted: true`
- `src/game/schedule.ts` — `nextTick` returns `null` while `g.menu` is set
- `src/game/save.ts` — `Dropped`/`DROPPED_KEYS` gain `"menu"`; `rehydrate`'s `runStarted ?? true`
- `src/hooks/GameContext.tsx` — `initialState` sets `menu: "start"`; the write effect's menu guard
- `src/components/screens/Menu.tsx` — new
- `src/components/screens/Challenges.tsx` — new
- `src/components/screens/Screens.tsx` — modal → menu → screen order
- `src/components/screens/RestartConfirm.tsx` — ghost button uses `btn.cancel`
- `src/components/rail/Rail.tsx` — New game dispatches `showMenu`
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the five new keys
- `src/index.css` — the menu's button column, hand-formatted, classes only
- `src/game/reducer.test.ts` — `showMenu`/`closeMenu`/`newRun`, the `nextTick` guard
- `src/game/save.test.ts` — `menu` dropped, `runStarted` default and round trip
- `src/hooks/GameContext.test.tsx` — boot on the menu, the seed prop, the write guard
- `src/test/render.test.tsx` — three `VIEWS` entries, the Menu and Challenges button tests
- `CLAUDE.md`, `README.md` — the overlay paragraph, the persistence gap, Playing it, Saved runs

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- Any actual challenge: no alternate rule set, modifier, unlock, id table, selection state or
  challenge-specific scoring. The list is empty and says so.
- Persisting the menu or the challenges view. `menu` is dropped from the snapshot; a reload starts
  at the menu because the boot path puts it there, not because it was saved.
- Routing `GameOver`'s and `Victory`'s New game / Replay seed buttons through the menu.
- Moving the seed dialog, the language button or any other rail control onto the menu; both stay on
  the rail's game page.
- A background, artwork or dedicated layout for the menu; it reuses `Overlay` and `.panel`.
- Keyboard, focus-order or ARIA work for the menu beyond the project's existing `focus-visible`.
- Migrating old saves or bumping `SAVE_VERSION`; see the assumption above for the one default read.
- Any change to the rules panel's content or the README's rule text — no tuppi rule moves here.
