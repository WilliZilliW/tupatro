---
id: 2026-09-16-confirm-hang-up-to-play-single
title: Offer to hang up the session when Single player is clicked during one
kind: ui
status: proposed
---

# Offer to hang up the session when Single player is clicked during one

## What

**Single player** on the start menu stops being a dead button while a multiplayer session is live —
whether a match is under way or the lobby is only waiting for people. Clicking it asks one
question, **hang up multiplayer?**, and a Yes ends this window's session and opens the
single-player screen behind it; a No leaves the session exactly as it was. Offline the button
behaves as it does today: one click, straight to the single-player screen, no question.

Nothing about the wire, the rules, the scores or the balance moves. `NET_VERSION` stays **6**,
`SAVE_VERSION` stays **3**, `SCOPE` gains no member and no reducer case changes.

## Prior specs

- **Contradicts `2026-09-14-single-player-separate-from-multiplayer` in one criterion, and this
  requirement's reading wins.** That spec's _"Single player is the gated door, and the gate is
  enforced as well as drawn"_ requires `disabled={net.live}` **and** an early return in the
  handler. The `disabled` attribute is **withdrawn**: a disabled button fires no click event, so
  the question the requirement asks for cannot be asked from behind it. The early return is
  **replaced** rather than deleted — the handler still refuses to reach `menu: "single"` while
  `net.live`, and opens the confirmation instead. Everything else that spec delivered stands: the
  two doors, `menu.singleLive` under the first of them gated `net.live && !spectating`, SCORES
  behind the single-player door, the `leaveChallenge` three-site list, and the whole of
  `SinglePlayer.tsx`.
- **Overlaps `2026-09-13-lobby-first-solo-and-viewer`'s shared-table guarantee and changes none of
  it.** A table draws no door, because `MoveButton` renders nothing while spectating, so it is
  offered neither the button nor the dialog and its only way out stays the banner's Leave. That is
  the delivered behaviour and this spec keeps it; see Out of scope.
- **Does not touch `2026-09-14-move-return-button-to-lobby`.** The return button stays in the
  lobby's footers, and that spec's recorded gap — the lobby's Start stays enabled mid-match — is
  neither fixed nor worsened here, because this dialog dispatches no `startChallenge`.
- **Does not touch `2026-09-12-fix-leave-challenge-desync`.** `leaveChallenge` and `resumeGame`
  stay the two named `local` exceptions, the list stays length two, and the dialog dispatches
  neither.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

- [ ] **The door asks instead of refusing.** The Single player `MoveButton` in
      `src/components/screens/Menu.tsx` carries **no** `disabled` prop, and its handler dispatches
      exactly `{ type: "openModal", modal: "hangup" }` when `net.live` and exactly
      `{ type: "showMenu", view: "single" }` otherwise. `grep -n "disabled" src/components/screens/Menu.tsx`
      finds nothing. A rewritten case in `src/components/screens/Menu.test.tsx` asserts, for a live
      host and a live guest in both locales, that the button is present and not disabled, that one
      click dispatches exactly the `openModal` action and nothing else, and that `net.hangUp` has
      **not** been called by the click on the door.
- [ ] **The confirmation is a modal, not component state.** `Modal` in `src/game/types.ts` is
      `"rules" | "seed" | "restart" | "scores" | "hangup"`; `Screens.tsx` routes `modal === "hangup"`
      to a new `src/components/screens/HangUpConfirm.tsx`, drawn through `Overlay` in the same shape
      `RestartConfirm.tsx` has. `grep -n "useState" src/components/screens/Menu.tsx` finds nothing.
- [ ] **Yes hangs up before it opens the door, and that order is the safety argument.**
      `HangUpConfirm`'s confirm calls `net.hangUp()` **first**, then dispatches
      `{ type: "closeModal" }` and `{ type: "showMenu", view: "single" }` — `showMenu` does not
      clear `g.modal`, so both are needed. `useNetGame`'s `hangUp` sets `roleRef.current = "off"`
      synchronously, so those two actions reach the reducer directly and `menu: "single"` is never
      set while this window is still a peer. A case in `Menu.test.tsx` asserts the call order (the
      `net.hangUp` stub recorded before the first dispatch) and the exact two-action dispatch list,
      in both locales.
- [ ] **No is free.** The cancel button reuses `btn.cancel`, dispatches exactly
      `{ type: "closeModal" }`, calls no `net` method, and returns to the start menu because
      `g.menu` is still `"start"` underneath. A case asserts the state after that dispatch equals
      the state before the modal was opened, and that `net.hangUp` was not called.
- [ ] **The confirm button is a `MoveButton`; the cancel is an ordinary button.** The Yes opens the
      screen that holds the only `resumeGame` dispatch and the third `leaveChallenge` dispatch, so
      it is drawn through `MoveButton` for the same reason the menu's two doors are, and a table
      rendering this modal sees only the cancel. `render.test.tsx`'s `TABLE_MODALS` — a
      `Record<Modal, true>`, so it fails to compile until `hangup` is listed — passes with the new
      member, finding no dispatch that moves the game.
- [ ] **A table still gets neither the door nor the dialog.** `MoveButton` is unchanged, and the
      delivered table branch of `Menu.test.tsx`'s _"shuts the single-player door and says why"_ case
      passes with its assertions intact: the button is absent, `menu.singleLive` is absent, and
      clicking the menu dispatches nothing. The case's host and guest branches are rewritten to the
      new behaviour rather than deleted.
- [ ] **`resumeGame` is still never sent inside a session, and the comment that claims it says
      why.** The comment above `resumeGame: "local"` in `src/net/protocol.ts` no longer cites
      `disabled={net.live}`; it says that the single-player door hangs the session up in the same
      click, so the window has stopped being a peer before the screen that dispatches `resumeGame`
      is drawn. `protocol.test.ts`'s exception-list length of **two** is unchanged, and `SCOPE`
      gains no member.
- [ ] **The pinned hang-up site list grows by exactly one file.**
      `src/test/invariants.test.ts`'s _"hangs up from the door, the room, the table's banner and the
      two result screens"_ list becomes `NetBanner.tsx`, `ChallengeOver.tsx`, `HangUpConfirm.tsx`,
      `Lobby.tsx`, `RaceOver.tsx`, and its comment records that this is the sixth site its previous
      comment predicted — the door opening. The `leaveChallenge` list (`ChallengeOver.tsx`,
      `RaceOver.tsx`, `SinglePlayer.tsx`) and the `resumeGame` list (`SinglePlayer.tsx`) are
      unchanged, and `grep -rn "net.hangUp" src/components/screens/Menu.tsx` finds nothing: the menu
      asks the question, the dialog ends the session.
- [ ] **Text, in both catalogues with matching placeholder sets.** `hangup.title`, `hangup.body`
      and `hangup.hostBody` are added to `src/i18n/fi.ts` and `src/i18n/en.ts`, along with
      `btn.yesHangUp`. `hangup.body` names what a hang-up costs — the session ends for this window
      and there is no reconnect, so the match cannot be rejoined — and `hangup.hostBody` is drawn
      **only** when `net.role === "host"` and says that the host's leaving ends the match for
      everybody. `menu.singleLive` is rewritten in place, keeps its `net.live && !spectating` gate,
      and no longer tells the reader to hang up in the lobby first; `grep -rn "aulassa ensin\|Hang up in the lobby first" src/i18n/`
      finds nothing. `i18n.test.ts`'s parity, placeholder and stray-Finnish cases pass.
- [ ] **The dialog renders with no session at all.** `render.test.tsx`'s modal fixture list gains
      `["the hang-up confirmation", () => loadedState({ modal: "hangup" }), () => <Screens />]`, and
      the sweep passes in both locales: no leaked key, no `undefined`, no Finnish in English output.
      With the off-context `net`, `hangUp` is a no-op and the confirm still opens the single-player
      screen, so the sweep needs no session stub.
- [ ] **No CSS and no state shape beyond the modal member.** `src/index.css` is unchanged — the
      dialog reuses `Overlay`, `h2`, `.dek` and `.row` — `GameState` gains no field, `save.ts` is
      unchanged because `modal` is not saved, and `hashState` is unchanged because the hash ignores
      `modal`.
- [ ] **Documentation and gates.** `CLAUDE.md` (the start-menu Known gap, the `MoveButton`/table
      paragraph and the `leaveChallenge`/`resumeGame` notes that cite the shut door), `README.md`
      lines about Single player being "shut while a session is live", and `docs/multiplayer.md`'s
      hosted-roguelike paragraph all say that the door opens through a confirmation that hangs up
      first; the test-count line matches what `npm test` prints. All five gates pass: `npm run lint`,
      `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`,
      `npm run build`. One browser reading is recorded in the pull request at **1280x800**,
      **1280x500** and **390x844**: a live host on the start menu, the click, the dialog with both
      body lines and both buttons on screen and hit-testable at 500 px height, and the
      single-player screen after Yes with the net banner gone.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Yksinpeli alkaa" is read as "the single-player screen opens", not "a run starts".** Yes lands
  on `menu: "single"`, where Continue, the new roguelike run and the three alternate rule sets
  already live. Starting a game directly would either resume a saved run without asking or replace
  one without the `restart` confirmation that exists for exactly that click.
- **The button loses its `disabled` attribute rather than staying greyed out and clickable.** The
  requirement says "even if you press that greyed-out button"; a disabled button fires no click
  event at all, and a button styled as unavailable that nevertheless acts is the control that lies
  `MoveButton.tsx` exists to forbid. The door reads as an ordinary door with a line under it saying
  what it will cost.
- **The gate is `net.live` and nothing finer.** A lobby that is only waiting and a match under way
  are both a live session, the requirement names both, and the net context holds no notion of "the
  match has begun" (`seq.n` is the session's, not the window's). A host who hangs up while three
  people are mid-deal therefore gets the same one question as a host alone in a room.
- **One dialog for a host and a guest, with one extra line for a host.** The two consequences are
  not the same — a guest leaving takes one chair out, a host leaving closes every link — so
  `hangup.hostBody` is drawn on top of `hangup.body` when `net.role === "host"` rather than folding
  both into one sentence that is half wrong for whoever reads it.
- **The dialog does not touch the run.** It dispatches no `leaveChallenge`, no `newRun` and no
  `startChallenge`, so after a hang-up mid-match this window still holds the networked match's
  `GameState` behind the menu, with `g.seats` naming humans who are no longer peers. Backing out
  of the single-player screen therefore lands on the start menu over a board that will never
  advance. This is **accepted and not new**: the shared table's banner Leave already produces
  exactly that state, and every route off that board — Continue, a new run, a mode's Play — is one
  click away on the screen the player was just taken to.
- **No confirmation offline.** With `net.live` false the click goes straight through, unchanged, so
  the single-player route costs no extra click for the player who never opened the lobby.
- **The modal id is `"hangup"` and the strings are `hangup.*` / `btn.yesHangUp`.** Chosen to match
  `restart` / `restart.*` / `btn.yesRestart`, the existing confirmation this one is modelled on.
- **`menu.singleLive` survives as a key.** Its text is rewritten to describe the question the door
  now asks; removing it would leave an enabled door with no warning that clicking it ends a
  session.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/game/types.ts` — `Modal` gains `"hangup"`; `GameState` gains nothing.
- `src/components/screens/HangUpConfirm.tsx` — **new**. The dialog: title, body, host line,
  `MoveButton` confirm calling `net.hangUp()` then dispatching `closeModal` and
  `showMenu { view: "single" }`, ordinary cancel dispatching `closeModal`.
- `src/components/screens/Screens.tsx` — the fifth `modal ===` branch, routed before the menu.
- `src/components/screens/Menu.tsx` — the Single player handler branches on `net.live`; the
  `disabled` prop and the early return go; the comment block above the component is rewritten.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `hangup.title`, `hangup.body`, `hangup.hostBody`,
  `btn.yesHangUp`; `menu.singleLive` rewritten.
- `src/components/screens/Menu.test.tsx` — the `describe.each(["host", "guest", "table"])` block's
  door cases, rewritten for host and guest and left intact for the table.
- `src/test/render.test.tsx` — the modal fixture list and `TABLE_MODALS`.
- `src/test/invariants.test.ts` — the pinned `net.hangUp` site list and its comment.
- `src/net/protocol.ts` — the comment above `resumeGame: "local"`.
- `CLAUDE.md`, `README.md`, `docs/multiplayer.md` — every sentence that says the door is shut.

## Out of scope

- **No `seq.n`-aware warning anywhere.** The lobby's Start staying enabled mid-match, recorded as a
  gap in `2026-09-14-move-return-button-to-lobby`, is untouched; this dialog is not a general
  "a match is under way" guard and does not become one.
- **No change to the other three ways out of a session**: the lobby footer's Hang up, the banner's
  Leave and the two result screens' Back to your run keep their behaviour and their call sites.
- **The peers left behind are still told what they are told today** — the host's departure raises
  `dropped` everywhere, a guest's reaches the host in a room and nobody on the code swap. Saying
  more needs a new `SessionStatus` or a new `NetMsg`, which is a transport increment with its own
  spec.
- **No reconnect and no rejoin.** A window that hangs up cannot come back into the match it left,
  and the dialog says so rather than offering a way.
- **No table behaviour changes.** `MoveButton` is not touched, and no door is drawn for a
  spectating window.
- **No `leaveChallenge` from the dialog**, so the `local` exception list stays length two and the
  three-site pin is unchanged.
- **Nothing about the rules, the scoring, the balance figures or the wire.** No `SCOPE` member, no
  `NET_VERSION` bump, no `SAVE_VERSION` bump, no `Rules.tsx` change, no README balance figure.
