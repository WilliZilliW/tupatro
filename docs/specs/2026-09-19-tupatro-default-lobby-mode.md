---
id: 2026-09-19-tupatro-default-lobby-mode
title: Make Multiplayer Tupatro the mode the lobby proposes
kind: ui
status: proposed
---

# Make Multiplayer Tupatro the mode the lobby proposes

## What

A host who opens the lobby, types a name and clicks Start without touching the mode picker starts
**Multiplayer Tupatro**, not the Tuppi Race. The picker still offers all three match modes and still
changes nothing else, but Multiplayer Tupatro is the one it opens on and the first one in the row,
so the page proposes it as the standard rather than listing it third. Nothing about the wire, the
save or any rule moves: `net.match` is unsaved, un-hashed session state, and only its initial value
and the order of the three buttons change.

## Acceptance criteria

- [ ] **The initial mode is `"tupatro"` in both places that hold one.** `useNetGame.ts`'s
      `useState<MatchId>` initial value and `netContext.ts`'s no-provider default object both read
      `"tupatro"`, and `grep -n '"race"' src/hooks/netContext.ts src/hooks/useNetGame.ts` finds no
      remaining default. The `useNetGame.test.tsx` case _"starts the default match mode and never a
      run"_ asserts `result.current.match === "tupatro"` before any `setMatch`, and that `start()`
      dispatches a `startChallenge` whose `id` is `"tupatro"`, with the same `seed: undefined` and
      the same single-human `seats` that case already pins.
- [ ] **`LOBBY_MODES` in `Lobby.tsx` is `["tupatro", "race", "tuppi"]`** — the same three ids, none
      added and none removed, still typed `MatchId[]` so the roguelike stays a compile error there.
      The `render.test.tsx` case _"draws a button per match mode and describes the chosen one"_
      asserts the `.modepicks` buttons' text in both locales is Multiplayer Tupatro's `nameOf`,
      then the race's, then Traditional Tuppi's — and that all three are still enabled.
- [ ] **The host-setup page opens on Multiplayer Tupatro.** With the default net stub,
      `.modepicks button[data-mode="tupatro"]` carries `on`, `descOf` of its `CHALLENGES` row is
      drawn, and neither the race's nor Traditional Tuppi's description is in `.lobbymode`'s
      `textContent`. The existing case _"opens with the race picked"_ is rewritten to name the new
      default rather than deleted.
- [ ] **The best line on that page reads Multiplayer Tupatro's own board.** A render case writes a
      won row to `tupatro-tupatro-v1` through `writeRaceScores("tupatro", …)`, renders the host-setup
      page with the default stub, and asserts `race.bestWon` with that row's deal count — and that
      neither the race's nor the traditional board's number appears.
- [ ] **Picking and starting are unchanged.** Clicking `data-mode="race"` still calls
      `net.setMatch("race")` and dispatches nothing; a host stub carrying `match: "tuppi"` still
      draws the traditional description and starts `"tuppi"`. Those three existing `render.test.tsx`
      cases keep their assertions with only the mode names swapped where they named the default.
- [ ] **`stubNet` in `src/test/harness.tsx` defaults `match` to `"tupatro"`**, so a test that says
      nothing about the mode sees what the product shows. Every test that needs another mode passes
      it explicitly; the suite is green with no test asserting a mode it never set.
- [ ] **Nothing on the wire or on disk moves.** `git diff` names no file under `src/game/` or
      `src/net/`: `NET_VERSION` stays **11**, `SAVE_VERSION` stays **3**, and `SCOPE`, `hashState`,
      `parseMsg` and `guestMay` are byte-identical. A guest still learns the mode from the host's
      numbered `startChallenge`, so no guest-side test changes.
- [ ] **The rules panel names all three modes, the default first.** `rules.mp`'s first entry in
      `fi.ts` and `en.ts` names Multiplayer Tupatro (`challenge.tupatro.n`: "Moninpeli-Tupatro" /
      "Multiplayer Tupatro") beside the Tuppi Race and Traditional Tuppi, and says it is the one the
      lobby opens on. Both catalogues keep the same list length and the same (empty) placeholder set,
      so `i18n.test.ts` stays green, and no new key is added.
- [ ] **`README.md` says which mode the picker proposes, and repeats the bot caveat there.** The
      "The lobby is where a game with other people is configured" paragraph and the "started from
      either door" line name Multiplayer Tupatro as the mode the picker opens on; the **Multiplayer
      Tupatro** section says the same; and the existing "Bots never spend a temppu … lopsided in the
      humans' favour by construction" bullet gains one sentence saying that this now applies to the
      default, so a host who starts with empty chairs plays the lopsided version unless they pick
      another mode. **Every measured figure in the balance tables is byte-identical** — no number is
      re-measured or restated.
- [ ] **`CLAUDE.md` stops stating the old default.** The three places that spell the list or the
      default — the lobby-is-multiplayer-only paragraph, Nami's "Single player only" bullet and the
      start-menu scope paragraph under Known gaps — spell the new order and the new default, and a
      grep of `CLAUDE.md` for the old phrase "defaults to" beside the race finds nothing.
- [ ] **Gates pass**: `npm run lint`, `npm run typecheck`, the repository's Prettier check over
      every `ts`/`tsx`/`json`/`md`/`html` file, `npm test` and `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **Open question (a) is answered "both": the default flips _and_ the picker's order changes.** The
  requirement says the lobby should _propose_ Multiplayer Tupatro "as standard", and a proposal that
  sits third in a row of three reads as an afterthought even when it is the preselected one. If the
  reviewer wanted the default alone, the diff to revert is one array literal in `Lobby.tsx`.
- **No "standard" / "recommended" badge is added to the picker.** Being preselected and first _is_
  the proposal; a label would be a new catalogue key in both locales, and the requirement asked for
  a default, not a new control. If the team wants the word on screen, it is a second, one-string
  change.
- **Open question (b) is answered "restate, do not re-measure".** The README's lopsidedness note
  stays where it is and gains one sentence about the default. Nothing is measured again: this change
  moves no number, and the existing figures were taken after Ikiliikkuja shipped.
- **No in-game warning is added for a host who starts the default alone against three bots.** The
  lobby already says, in `lobby.alone`, that starting locks the room; adding "and bots never spend a
  temppu" would be a rules explanation in a footer. The README carries it instead. This is the
  sharpest consequence of the change and is the thing a reviewer should weigh.
- **Open question (c) is answered "no version bump", as the issue suggests.** `net.match` is window
  state: never on `GameState`, never hashed, never saved, and never sent except inside the host's
  own numbered `startChallenge`, whose shape does not change. A v11 peer meeting a v11 peer is
  unaffected whichever mode the host picked.
- **`stubNet`'s default flips with the product's.** A test harness that proposes a different mode
  from the app is a test suite that describes a game nobody plays; the cost is that every test which
  silently relied on the race must now say so.
- **`rules.mp`'s first entry is edited, which is a fix this spec inherits rather than causes.** That
  string has named only the Tuppi Race and Traditional Tuppi since Multiplayer Tupatro shipped on 16
  September; leaving it while making the unnamed mode the default would have the rules panel teach
  the player that the lobby starts something else.
- **A host's choice is still not remembered between visits.** `net.match` resets to the default on
  every mount, so a host who deliberately picks the race today opens on Multiplayer Tupatro
  tomorrow. Persisting the last pick is not asked for and is not added.
- **This reverses a delivered criterion in two specs, named rather than silently flipped.**
  `2026-09-08-traditional-tuppi-multiplayer-mode.md`'s _"The lobby chooses the mode"_ criterion
  ("`match` / `setMatch`, default `"race"`") and
  `2026-09-14-single-player-separate-from-multiplayer.md`'s _"The lobby is multiplayer-only"_
  criterion ("`LOBBY_MODES` … is `["race", "tuppi"]` … defaulting to `"race"`") both pin the old
  default. **This spec wins on the default and the order only**; every other clause of both — the
  choice living on the net context, `MatchId` typing, the roguelike being a compile error there,
  `net.start()` dispatching the shown mode — is untouched and still binding.
  `2026-09-16-tupatro-match-mode-with-consumables.md` is **overlapped, not contradicted**: it added
  `"tupatro"` to `LOBBY_MODES` and its "bots never spend a temppu" assumption stands unchanged.

## Touch points

- `src/hooks/useNetGame.ts` — the `useState<MatchId>("race")` at the top of `useNetGame`; `matchRef`
  and `start()` are unchanged.
- `src/hooks/netContext.ts` — `match: "race"` in the no-provider default object, and the comment
  above `match` on the `Net` type if it names the race as the default.
- `src/components/screens/Lobby.tsx` — `LOBBY_MODES` (the array only); `ModePick`, `rowFor` and the
  best line's `readRaceScores(net.match)` need no change.
- `src/test/harness.tsx` — `stubNet`'s `match` default.
- `src/hooks/useNetGame.test.tsx` — _"starts the default match mode and never a run"_.
- `src/test/render.test.tsx` — _"holds the name, the mode and the board on the host-setup page"_,
  _"opens with the race picked"_, _"draws a button per match mode and describes the chosen one"_,
  _"describes the traditional mode once the picker is on it"_, and the lobby half of the
  best-result cases that call `inLobby(...)`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the first entry of `rules.mp` in each, no new key.
- `README.md` — the lobby paragraph, the "started from either door" line in the match-mode section,
  the Multiplayer Tupatro section's opening, and its "Bots never spend a temppu" bullet.
- `CLAUDE.md` — the lobby-is-multiplayer-only paragraph, Nami's "Single player only" bullet, and the
  Known-gaps start-menu paragraph, wherever they spell `LOBBY_MODES` or the `net.match` default.

## Out of scope

- **Teaching `chooseAI` to spend a temppu.** That is the honest fix for the lopsidedness this
  default makes more common, and it needs a new `auto` action, a `nextTick` arm, a `SCOPE` entry and
  a heuristic — a spec of its own, as both CLAUDE.md and the README already say.
- **Giving Multiplayer Tupatro a row on the single-player screen.** `SOLO_MODES` in
  `SinglePlayer.tsx` still filters it out, for the same mechanical reason: a solo board would deal
  the player four draws a deal against three opponents holding none.
- **Any new catalogue key**, including a "standard" or "recommended" label on the picker button, and
  any lobby-side warning about bots and temput.
- **Persisting the host's last-picked mode** across visits or into the save.
- **`NET_VERSION`, `SAVE_VERSION`, `SCOPE`, `hashState`, `parseMsg`, `guestMay`** and anything else
  under `src/net/` or `src/game/`.
- **Re-measuring balance.** No figure in the README's tables is recomputed; the mode's rules,
  targets and point tables are untouched.
- **`CHALLENGES`'s own order in `content.ts`**, and so the order of the single-player screen's rows.
- **The lobby's Start-mid-match gap** (`net.canStart` knowing nothing about `seq.n`), which this
  change neither widens nor closes.
