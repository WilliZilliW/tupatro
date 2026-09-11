---
id: 2026-09-11-room-first-multiplayer-lobby
title: Open the room before assigning chairs
kind: infra
status: proposed
---

# Open the room before assigning chairs

## What

A host can open a room before deciding who sits where. Players join a named waiting room, then the
host assigns every connected player to a chair and starts the selected match when nobody remains
unassigned.

## Acceptance criteria

- [ ] The room route lets a host enter a temporary display name and open a room without first
      selecting a chair or marking chairs open.
- [ ] The room route lets a player enter a temporary display name and join as an unassigned player;
      the shared-table role remains unnamed and chairless.
- [ ] A temporary display name is trimmed, has a documented maximum length, and is rejected when it
      is empty after trimming; it is window-local session data and never enters `GameState`.
- [ ] The host sees every connected player, including itself, in a waiting-room roster and is the
      only window that can assign, move, unassign or remove a player.
- [ ] One player can occupy at most one chair and one chair can hold at most one player. Moving a
      player frees its previous chair.
- [ ] Every chair without an assigned player is shown as and becomes an AI chair when the match
      starts.
- [ ] Start is disabled while any connected player is unassigned, and the lobby states that reason.
- [ ] A player leaving before Start disappears from the roster and frees its chair. A shared table
      leaving does not change chair assignments or Start readiness.
- [ ] The host may select Race or Traditional Tuppi while the room is open. Only the host can start
      the match, and the first numbered action freezes the displayed chair assignment into the
      challenge's `seats` tuple.
- [ ] Players joining after the first numbered action and chair changes after it remain rejected.
- [ ] A guest sees its temporary name and either its assigned character or a waiting-for-host state;
      it cannot edit the roster or chair assignments.
- [ ] A shared table sees that it joined read-only, consumes no chair and does not block Start.
- [ ] The manual code-swap route keeps its current chair-first invitation flow and remains reachable
      as the advanced connection route.
- [ ] Every new player-facing string exists in both `src/i18n/fi.ts` and `src/i18n/en.ts` and is
      reached through the typed catalogue.
- [ ] `NET_VERSION` changes so an older arrival-order client cannot enter a host-controlled seating
      session.
- [ ] Protocol, session, seating, hook and render tests cover joining out of order, assigning,
      moving, unassigning, removing, disconnecting, duplicate-chair refusal, Start gating, AI
      chairs, the shared table and the unchanged manual route.

## Assumptions

- The host assigns every player, including itself; guests do not request chairs.
- Connected unassigned players block Start until the host seats or removes them.
- Display names distinguish people in one lobby only. They are not credentials and do not identify
  a returning connection.
- Empty chairs are AI rather than closed chairs, so one to four connected players can start.
- The room route receives the new flow first. Keeping the manual route unchanged avoids combining a
  waiting-room redesign with raw WebRTC invitation lifecycle changes.

## Touch points

- `src/net/protocol.ts` — version and validated waiting-room messages.
- `src/net/session.ts` — pre-game admission and seat-based authorization after Start.
- `src/net/seating.ts` — room roster admission instead of first-open-chair claiming.
- `src/net/room.ts` — targeted waiting-room message routing.
- `src/hooks/netContext.ts` — window-local roster, assignments and host commands.
- `src/hooks/useNetGame.ts` — room lifecycle, synchronization and final `seats` tuple.
- `src/components/screens/Lobby.tsx` — name entry, roster, chair assignment and Start gate.
- `src/i18n/fi.ts` and `src/i18n/en.ts` — bilingual waiting-room copy.
- `README.md` and `CLAUDE.md` — player flow and architecture record.

## Out of scope

- Rejoining a match after a dropped connection, resume tokens and state snapshots.
- Recovering or migrating a session after the host closes or reloads its tab.
- Changing seats after the match starts.
- Persistent profiles, accounts, authenticated names or chat.
- Redesigning the manual code-swap route.
- Changing game rules, scoring, balance or `GameState`.
