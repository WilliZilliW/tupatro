---
id: 2026-09-09-start-menu-solo-run
title: Keep start-menu run controls exclusive to solo roguelike play
kind: ui
status: delivered
---

# Keep start-menu run controls exclusive to solo roguelike play

## What

Continue and New game in the start menu refer only to the single-player roguelike.
An ongoing challenge or multiplayer game has a separately labelled return button,
and a live session cannot start a shared roguelike through the start menu.

## Acceptance criteria

- [x] Continue appears only when the game behind the menu is a roguelike with exactly one human seat; it closes the menu without changing the run. A live session that has started no match still qualifies, because nothing has replaced that run.
- [x] A started challenge, match or shared roguelike uses its own return label, never Continue, and returning only closes the menu.
- [x] Offline New game still creates a fresh seat-0 single-player roguelike, including from a challenge; an existing game requires confirmation and Cancel preserves it.
- [x] New game and its restart confirmation cannot dispatch newRun while a session is live, for host, guest or table. Multiplayer, Rules and SCORES remain reachable.
- [x] Finnish and English explain that the run controls are single-player and that a live session must be disconnected first.
- [x] Tests cover both locales, all three challenges, live host/guest/table, fresh/resumed runs and the confirmation path. Mutation checks prove the scope guards matter.

## Assumptions

- The user's clarification scopes this to the start menu, not all buttons named Continue in result screens, nor the seed dialog or network protocol.
- Continue does not abandon an active challenge to restore its parked run. The separate return button preserves access to that challenge; its result screen remains the way back to the parked run.
- New game may replace an offline challenge after confirmation, as before; it never starts a challenge or uses lobby chairs.
- Disconnecting is explicit through Multiplayer, not a side effect of clicking New game.

## Touch points

- `src/components/screens/Menu.tsx` — run eligibility and separate return controls.
- `src/components/screens/RestartConfirm.tsx` — live-session guard at confirmation.
- `src/components/screens/Menu.test.tsx` — behavior regression coverage.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — menu explanation and return labels.
- `README.md`, `CLAUDE.md` — current start-menu contract.

## Out of scope

- Game rules, scoring, balance, saves, protocol scopes and version changes.
- Automatic disconnection, restoring a parked run mid-challenge, or changes to result-screen Continue and rail seed controls.

## Verification

- 2,099 tests passed, including 56 new menu cases. Typecheck, lint, format check,
  production build and editor diagnostics passed.
- Mutation checks: removing the challenge exclusion failed six cases; removing
  both live-session disabled guards failed 20 cases, including independent menu
  and confirmation assertions. All mutations restored before final gates.
- Browser: 20 provider-injected cases using the actual Screens component and CSS,
  both locales at 1280×500 and 390×844. Solo Continue, challenge/match return labels,
  disabled live-session New game and disabled restart confirmation rendered correctly.
  Every button was hit-testable after scrolling the existing overlay where needed;
  no horizontal page overflow. Short-window menus can require scrolling to SCORES.
- No live transport, physical-device, balance or game-rule verification claimed:
  the change is limited to start-menu UI. Working tree delivered without commit/push.

## Follow-up: the label read the session, not the game

Reported after delivery: with a room open and no match started, the menu said Back to match and
lowered onto the solo roguelike. `solo` included `!net.live`, so a live session relabelled a run
it had not replaced.

- Both labels now derive from `challenge` and the human-seat count alone. A shared roguelike gets
  its own neutral label, `menu.returnGame`, so no case falls through to a wrong one.
- Mutation check: restoring `!net.live` in `solo` failed the six new open-room cases (host, guest
  and table, both locales). Restored before the final gates.
