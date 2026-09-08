---
id: 2026-09-08-multiplayer-behind-one-door
title: Put everything multiplayer behind one menu door, and leave a challenge from its result screen
kind: ui
status: proposed
---

# Put everything multiplayer behind one menu door, and leave a challenge from its result screen

## What

The start menu becomes a short, grouped list of six choices instead of a column of seven or eight:
**Continue** (only with a run to return to) and **New game**; then **Multiplayer** and
**Challenges**; then **Rules** and **SCORES**. Multiplayer opens a new menu view that holds
everything about playing with other people — Host a game, Join a game, Hang up while a session is
live, and a line saying whether this window is hosting or has joined — so the start menu no longer
carries two transport buttons and the lobby no longer carries Hang up twice.

**Leave the challenge disappears from the start menu.** The third button on the Tuppi-Rummikub and
Tuppi Race result screens stops going to the menu and dispatches `leaveChallenge` itself, relabelled
**Back to your run**: one click instead of two, and the parked run comes back exactly as it did.
The deliberate consequence is that a challenge or a race **in progress** can no longer be handed
back mid-deal — it is played out, or the page is reloaded, which loses it.

No tuppi rule, no score, no balance figure and no saved field changes. The Challenges list, the
lobby's chairs and everything in `src/net/` are untouched apart from where a Back button lands.

## Prior specs and documents

- **Contradicts `2026-09-06-tuppi-rummikub-challenge` (delivered) and, through it,
  `2026-09-07-race-to-target-mode` (delivered), and this requirement's reading wins.** That spec's
  criterion says "the menu shows a Leave-the-challenge button only while `challenge !== null`, and
  it is the only site that dispatches `leaveChallenge`". After this change the menu shows no such
  button and the two result screens are the only sites that dispatch it. **The capability that goes
  with it is abandoning a challenge mid-deal**, which the race spec listed among the machinery it
  inherited ("parking the main run and giving it back exactly … the Leave button"). That is a
  reversal a reviewer must see rather than discover: the reducer's `leaveChallenge` is unchanged
  and still restores the parked run whole, but nothing on screen reaches it until the result screen
  is up.
- **Narrows `2026-09-06-start-menu-with-continue-and-challenges` (delivered).** Its criterion pins
  `Menu.tsx`'s buttons "in this DOM order: Continue, New Game, Challenges, Rules and SCORES"; the
  order becomes Continue, New game, Multiplayer, Challenges, Rules, SCORES, in three groups.
  Everything else it delivered stands and is re-pinned below: Continue is `closeMenu` and appears
  only with `runStarted`, New Game confirms exactly when Continue is offered, the restart
  confirmation's ghost button is `btn.cancel`, and Rules and SCORES open and close back to the menu.
- **Overlaps `2026-09-08-webrtc-transport` (delivered) in exactly two buttons and one panel.** It
  put Host a game and Join a game on the start menu and Hang up in `Lobby.tsx`; all three move to
  the new view, and Hang up's duplicate goes. The relay, `SCOPE`, `guestMay`, `hashState`, the
  signalling codec, the QR encoder, `NetBanner` and the never-save-a-networked-run rule are not
  touched, and no `src/net/` file changes.
- **Overlaps `2026-09-08-race-starts-from-the-lobby` (delivered, this branch's parent commit) only
  at the menu's gate line and the lobby's Back.** The Challenges button keeps `disabled={net.live}`
  and `menu.noChallenge` beside it, and `RaceOver`'s Play again and Replay seed keep `g.seats`.
  The race's route (Multiplayer → Host a game → the chair table → Start), the chairs, `seatsFor()`
  and the race board's single reader stay exactly as delivered.
- **Leaves `2026-09-07-new-game-skips-seat-picker` (delivered) as it is**, and a criterion re-pins
  it: no click on New Game or on the restart confirmation reaches a chair table, now or through the
  new view.
- **Not already delivered.** Today `Menu.tsx` holds eight buttons in one flat `.menubtns` column
  including Leave the challenge, `MenuView` is `"start" | "challenges" | "lobby" | "join"`, and
  `net.hangUp` is called from two places in `Lobby.tsx` and nowhere else.

## Acceptance criteria

- [ ] **The menu is six buttons in three groups.** `Menu.tsx` renders three
      `<div className="menugroup">` children inside the existing `.menubtns` column: Continue
      (`btn.continue`, only when `g.runStarted`) and New game (`btn.newGame`); Multiplayer
      (`btn.multiplayer`) and Challenges (`btn.challenges`); Rules (`btn.rules`) and
      `<ScoresButton />`. `.menubtns button` therefore still matches every button in DOM order, and
      the delivered order test in `src/test/render.test.tsx` is updated to that six-item list with
      `runStarted: true` and a five-item list with `runStarted: false` in which neither locale's
      `btn.continue` appears. Clicking Multiplayer dispatches exactly
      `{ type: "showMenu", view: "multi" }`, and no button on the menu is labelled `btn.hostGame`,
      `btn.joinGame` or `btn.hangUp` in either locale.
- [ ] **New game and the challenge gate do not move.** New game's
      `runStarted ? { type: "openModal", modal: "restart" } : { type: "newRun" }` branch is
      unchanged, the delivered `it.each` over both values still passes unedited, and the delivered
      "reaches no lobby from New Game or the restart confirmation" case passes with `"multi"` added
      to the views it forbids. The Challenges button keeps `disabled={net.live}`, `menu.noChallenge`
      still renders inside the second group while `net.live`, and the delivered "shuts the challenge
      door while a session is live" case passes unedited. The Multiplayer button is **never**
      disabled: it is the only route to Hang up.
- [ ] **The Leave button and its string are gone.** The `challenge !== null` block leaves
      `Menu.tsx`; `btn.leaveChallenge` and the now-unread `btn.toMenu` are deleted from
      `src/i18n/fi.ts` and `src/i18n/en.ts`; `grep -rn "btn.leaveChallenge\|btn.toMenu" src/` finds
      nothing. `render.test.tsx`'s `describe("the menu during a challenge")` and its two cases are
      deleted and replaced by the result-screen cases below, and a new case asserts that a menu
      rendered over `laydownState({ menu: "start", runStarted: true })` dispatches no
      `leaveChallenge` from any of its buttons.
- [ ] **`MenuView` gains `"multi"` and `Screens` gains its case.**
      `src/game/types.ts` reads `"start" | "challenges" | "multi" | "lobby" | "join"`, and
      `Screens.tsx` returns `<Multi />` for `menu === "multi"` inside the delivered
      modal → menu → screen order. Tests: `loadedState({ menu: "multi", modal: "rules" })` renders
      the rules panel and no `.multi` element; `loadedState({ menu: "multi", screen: { kind:
"shop" }, shop: SHOP })` renders the view and no `.shelf`. `SCOPE` is untouched — `showMenu` is
      already `local` — and `protocol.test.ts`'s local-membership and "a local action leaves the
      hash unchanged" assertions pass with no edit.
- [ ] **`src/components/screens/Multi.tsx` holds the door, and only the door.** It renders through
      `Overlay` with `<h2>{t("multi.title")}</h2>`, a `.dek` of `multi.dek`, then, in DOM order:
      Host a game (`btn.hostGame` → `{ type: "showMenu", view: "lobby" }`), Join a game
      (`btn.joinGame` → `{ type: "showMenu", view: "join" }`), Hang up (`btn.hangUp`, rendered
      **only** when `net.live`, calling `net.hangUp`), the session line, and Back (`btn.back` →
      `{ type: "showMenu", view: "start" }`). Tests: offline it draws three buttons and no
      `btn.hangUp` in either locale; with a live host stub it draws four, clicking Hang up calls
      `net.hangUp` once and dispatches nothing, and clicking Host a game, Join a game and Back
      dispatches those three actions and nothing else.
- [ ] **The session line says which side this window is and how many chairs answered.** With
      `net.live` the view renders one `.multisession` element: for `role: "host"`,
      `t("multi.hosting", { n: fmt(k) })` where `k` is the number of `net.chairs` whose `kind` is
      `"open"` and whose `state` is `"connected"`; for `role: "guest"`, `t("multi.joined")`, which
      carries no count (see Assumptions). Tests with `stubNet`: a host with two connected open
      chairs renders the hosting line with `2`, a host with none renders it with `0`, a guest stub
      renders the joined line, and offline `container.querySelector(".multisession")` is `null`.
- [ ] **Hang up leaves `Lobby.tsx`, and neither lobby view becomes a dead end.**
      `grep -c "net.hangUp" src/components/screens/Lobby.tsx` is `0`. The host view and the seated
      guest view each gain a Back button (`btn.back`) dispatching
      `{ type: "showMenu", view: "multi" }`, and the pre-invite table view's Back changes from
      `view: "start"` to `view: "multi"` — the delivered case at `render.test.tsx:1025` is updated
      to that action. Tests: rendered with `hostingNet()` and with a guest stub, each view has
      exactly one `btn.back` dispatching that action and no button labelled `btn.hangUp` in either
      locale; the host view's Start still calls `net.start` and is still disabled until every open
      chair is connected.
- [ ] **The result screens leave the challenge in one step.** `ChallengeOver.tsx`'s and
      `RaceOver.tsx`'s third button is labelled `btn.backToRun` and dispatches exactly
      `{ type: "leaveChallenge" }`; neither file dispatches `showMenu` any more, and those two are
      the only components that dispatch `leaveChallenge` (`grep -rln "type: \"leaveChallenge\""
src/components/` names exactly them). Tests in both locales: on each screen exactly one button
      carries the label, clicking it dispatches `leaveChallenge` and no `showMenu`, and
      `RaceOver`'s Play again and Replay seed still dispatch `startChallenge` with `seats: g.seats`
      as delivered. `src/game/reducer.ts`, `src/game/actions.ts` and `SCOPE.leaveChallenge` are
      unchanged.
- [ ] **The Challenges list and the race board do not move.** `Challenges.tsx` is byte-identical:
      the race row is still filtered out, no race row and no race board is drawn anywhere new, and
      `Multi.tsx` imports nothing from `game/storage.ts`. `grep -rln "readRaceScores" src/` names
      only `game/storage.ts`, `Lobby.tsx`, `RaceOver.tsx` and their tests, so CLAUDE.md's list of
      the seven components that read a board while they render — and its count — do not change.
- [ ] **The text, in both languages, `fi.ts` first.** Added: `btn.multiplayer`
      ("Moninpeli" / "Multiplayer"), `btn.backToRun` ("Takaisin ajoosi" / "Back to your run"),
      `multi.title` (same two words as the button), `multi.dek`
      ("Isännöi peliä tai liity toisen peliin." / "Host a game, or join someone else's."),
      `multi.hosting` and `multi.joined`; `multi.hosting` carries a `{n}` placeholder in **both**
      catalogues and `multi.joined` in neither. Removed: `btn.leaveChallenge`, `btn.toMenu`. The
      number goes through `fmt()` and the line through `<Interpolate>` if it needs a node.
      `i18n.test.ts` passes, and the multi view renders in both languages — offline, hosting and as
      a guest — with no `undefined`, no `[object Object]`, no `NaN`, no leaked catalogue key and no
      Finnish stopword in English output: one `VIEWS` entry for `menu: "multi"` plus entries in the
      lobby block's net-stubbed sweep for the hosting and guest states.
- [ ] **The documents say where multiplayer lives and what leaving now costs.** `Rules.tsx`'s
      `rules.mp` first line names **Multiplayer** as the door and Host a game inside it; `README.md`
      updates the start-menu paragraph (three groups, six choices), "Playing with other people", the
      Tuppi-Rummikub parking paragraph and the race's parking paragraph, all of which currently name
      "the menu's Leave the challenge", to name the result screen's **Back to your run** and to say
      plainly that a challenge in progress is played out or reloaded away. `CLAUDE.md`: the
      "Overlays are state, not calls" paragraph lists the five menu views; the challenge section's
      sentence about `Menu.tsx`'s Leave button is replaced by the two result screens; the
      known-gaps entry for a reload during a challenge notes it is now the only mid-deal exit.
      `docs/multiplayer.md`'s stage-4 line "two menu buttons" becomes the one door plus the view.
- [ ] **Every boundary that held still holds.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass.
      `GameState` gains no field; nothing under `src/game/` imports `../net`; `useGameLoop` stays
      the only `setTimeout` call site; `Math.random` stays one call site in `rng.ts`; no
      module-level `let` is added; `SAVE_VERSION` stays **3** and `"menu"` stays in `Dropped` and
      `DROPPED_KEYS`, so `"multi"` is never written to disk. Test counts in `CLAUDE.md` are updated
      if `npm test` prints a number other than 1,236.
- [ ] **One browser reading, recorded in the pull request**, because jsdom lays nothing out. With
      `npm run dev` at **1280x800** and **390x844**: the menu's three groups are visibly separated,
      all six buttons are on screen with no page scroll and hit-testable at their centres, and
      Multiplayer → Host a game → Back returns to the multi view rather than to the start menu.
      `.menugroup`'s rules are added to `src/index.css` by hand, classes only, in the file's compact
      style.

## Assumptions

Nobody answered a question while these were written. Each is a reading that could have gone the
other way, and each is a consequence a reviewer should look for in the diff.

- **Moving Hang up out of `Lobby.tsx` would strand a hosting player, so both session views gain a
  Back.** The host view holds Start and Hang up and nothing else; the seated-guest view holds Hang
  up alone. With Hang up gone and no Back, a host who has not yet connected everybody could not
  reach any other screen. Back goes to `"multi"` — the door the lobby was opened from — and the
  table view's Back is changed from `"start"` to the same place for consistency. Neither was asked
  for.
- **`btn.toMenu` is deleted along with `btn.leaveChallenge`.** Its only two readers were the
  buttons this change relabels `btn.backToRun`, and a catalogue entry nothing reads is drift. The
  requirement named only `btn.leaveChallenge`.
- **A guest's line carries no count.** `net.chairs` is only ever patched on the host; a guest's
  stays `OFF_CHAIRS`, so any number it printed would be `0` or a hardcoded `1` — neither of them
  information. This narrows the requirement's "how many chairs are connected" to the hosting case.
  A reviewer who wants a guest to see the table needs the host to send it, which is a transport
  change.
- **The consequence is narrower than "a challenge cannot be abandoned".** New game is still on the
  menu during a challenge and still replaces the whole state, parked run included, so a challenge
  is escapable — at the price of the run it parked. What is no longer possible is being **given the
  parked run back** mid-deal. A reload is the other exit and has always lost the challenge.
- **`leaveChallenge` stays `flow`, so over a live session Back to your run takes every peer out of
  the race**, and each peer then restores its own parked run — or `createRun(undefined)`, which
  draws its own seed. The peers' hashes differ from that moment and the banner may say they have
  drifted apart. This is exactly what today's two-step route already does; it is now on the natural
  path at the end of a match. No automatic hang-up is added.
- **Three groups are three `.menugroup` divs inside the one `.menubtns` column**, separated by a
  rule in `src/index.css`, rather than three sibling `.menubtns`. `.menubtns button` is a descendant
  selector, so the delivered order test keeps its selector and only its expected list changes.
- **The multi view carries Back and no `ScoresButton`** — the same reading
  `2026-09-06-start-menu-with-continue-and-challenges` recorded for Challenges: the board is two
  clicks away (Back, then SCORES), so the "an overlay must not hide the board" rule is met
  transitively. A reviewer who disagrees should ask for a `ScoresButton` on both views.
- **`menu.noChallenge` keeps its delivered wording**, "Hang up first" included, even though hanging
  up is now one click further away and the sentence names the lobby rather than Multiplayer. It is
  still true, and rewording it was not asked for.
- **The third group's SCORES button stays the `ScoresButton` component**, so group three is Rules
  plus a component rather than two literal buttons; the rendered label is still `btn.scores`.
- **A `#j=` invitation link still needs two clicks.** Boot does not raise the join view, and
  `codeInHash` is read by `Lobby.tsx` when the lobby is reached, so a phone that opened the QR link
  now goes Multiplayer → Join a game and finds the code already in the box — one click more than
  before. Auto-raising it is out of scope.
- **The multi view is a menu view, not a `Screen` kind**, so the compiler-bound `SCREENS` fixture
  in `render.test.tsx` does not cover it and the hand-written cases above are its only guard — the
  same cost the menu and the challenges list already carry.
- **No confirmation is asked for Hang up or for Back to your run.** Hanging up ends a session and
  Back to your run ends a challenge that is already over; neither loses anything the player has not
  finished with.

## Touch points

- `src/game/types.ts` — `MenuView` gains `"multi"`
- `src/components/screens/Menu.tsx` — three `.menugroup` groups, the Multiplayer button, the Leave
  button and the two transport buttons removed
- `src/components/screens/Multi.tsx` — new: the door, the session line, Hang up, Back
- `src/components/screens/Screens.tsx` — the `menu === "multi"` case
- `src/components/screens/Lobby.tsx` — both `net.hangUp` buttons removed; Back in the host and
  guest views; the table view's Back goes to `"multi"`
- `src/components/screens/ChallengeOver.tsx` — the third button: `btn.backToRun` → `leaveChallenge`
- `src/components/screens/RaceOver.tsx` — the same, Play again and Replay seed untouched
- `src/components/screens/Rules.tsx` — `rules.mp`'s route
- `src/i18n/fi.ts` then `src/i18n/en.ts` — six keys added, two removed, `rules.mp` reworded
- `src/index.css` — `.menugroup`, hand-formatted, classes only
- `src/test/render.test.tsx` — the menu's order and dispatches, the multi view's cases, the lobby's
  Back and the missing Hang up, both result screens, the `VIEWS` and net-stubbed sweep entries, the
  deleted "the menu during a challenge" block
- `src/test/harness.tsx` — nothing expected; `stubNet` already covers `role`, `live` and `chairs`
- `CLAUDE.md`, `README.md`, `docs/multiplayer.md` — the five menu views, the new exit from a
  challenge, the door's name

## Out of scope

- **Any tuppi rule, scoring or balance change.** No figure in the README moves and no measurement
  is asked for.
- **Anything inside `src/net/`**: the relay, `SCOPE`, `guestMay`, `hashState`, the signalling codec,
  the QR encoder, reconnect, an AFK timer, nicknames, spectators, TURN and automatic signalling.
- **Hanging up automatically** when a race ends, when `leaveChallenge` is dispatched, or when a peer
  drops.
- **Raising the join view from a `#j=` link at boot**, and any change to `codeInHash`'s reader.
- **Leaving a challenge mid-deal by any route**, an in-run Leave button, and a confirmation dialog
  for leaving.
- **Filing a board row for a networked race**, and teaching `raceRowFor` which seat is looking —
  still the delivered debt in `docs/multiplayer.md`.
- **Tuppi-Rummikub over a session.** The menu's gate and its line stay exactly as delivered.
- **Adding a race row or a race board to the Challenges list**, or a second reader of
  `tupatro-race-v1`.
- **`SAVE_VERSION`, the snapshot's shape, `GameState`'s fields and the reducer's cases.**
- **ARIA, focus order and keyboard routes** through the new view — accessibility stays the
  documented known gap.
