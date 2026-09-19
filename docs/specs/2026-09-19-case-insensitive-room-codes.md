---
id: 2026-09-19-case-insensitive-room-codes
title: Make a room code case-insensitive at one door, and prove it
kind: infra
status: proposed
---

# Make a room code case-insensitive at one door, and prove it

## What

A player who types the host's eight-character room code in lower case, upper case or mixed case
reaches the host's room. **That already works** — `enterRoom` in `src/hooks/useNetGame.ts` has
normalised the typed string with `raw.trim().toUpperCase()` since the room route shipped
(`fe880f6`, 8 September), and `roomIdFor` normalises again — so this is not a behaviour change a
player can see. What it changes is that the rule stops being spelled in two places and stops being
provable only indirectly: `normalizeRoomCode` becomes the one door, `openRoom()` applies it to the
Trystero **password** as well as to the room id, and two tests pin the end-to-end path a player
actually walks.

The live trap this closes: a room's code is its name _and_ its password, and `openRoom()` today
normalises only the name (`roomIdFor(code)`) while handing the raw string over as
`password: code`. Every reachable caller happens to pass an already-canonical code, so nothing
fails today — but a caller that did not would put two peers in the same room holding different
encryption keys, where the offers arrive and cannot be decrypted: no connection, no status, no
banner, nothing on screen to read.

## Acceptance criteria

- [ ] `src/net/room.ts` exports `normalizeRoomCode(code: string): string`, returning
      `code.trim().toUpperCase()`, and it is the **only** spelling of that rule under `src/`:
      `grep -rn "toUpperCase" src/net/ src/hooks/` shows no second room-code normalisation, and in
      particular `enterRoom`'s own `raw.trim().toUpperCase()` (currently `src/hooks/useNetGame.ts`
      line 417) is replaced by a call to it.
- [ ] `openRoom(code, lan, ev, join?)` normalises **once** and uses that value for all three of the
      Trystero `password`, the `roomIdFor(...)` argument and the returned `Room.code`.
- [ ] `src/net/room.test.ts` asserts that `openRoom("  abcd1234 ", …)` joins
      `roomIdFor("ABCD1234")` with `config.password === "ABCD1234"` and returns a `Room` whose
      `code` is `"ABCD1234"` — the password half is what no existing case covers.
- [ ] `roomIdFor` keeps its current behaviour and both of its existing cases in `room.test.ts`
      ("carries the protocol version" and "is the same room however the code was typed") pass
      unchanged, `NET_VERSION` still in the id.
- [ ] A new case in `src/hooks/useNetGame.test.tsx` drives the path the player walks:
      `enterRoom("  aBcD1234 ", "player")` opens the stubbed room with `"ABCD1234"` and leaves
      `net.room === "ABCD1234"`. That file mocks `../net/room` wholesale, so its mock factory has to
      export `normalizeRoomCode` (or fall back to `importActual`) or every `enterRoom` case throws.
- [ ] `NET_VERSION` stays `11` and `src/net/protocol.ts` is unchanged. Justification, and it must
      hold: no reachable call site passes a non-canonical code today — the host's comes from
      `makeSeed()`, the guest's is normalised before the call — so no peer's room id or password
      moves, and a v11 peer on the old build and a v11 peer on the new one still meet.
- [ ] Nothing under `src/game/` changes. `hashState`, `SCOPE`, `guestMay`, `parseMsg` and
      `SAVE_VERSION` are untouched.
- [ ] No player-facing string is added, removed or edited: `src/i18n/fi.ts` and `src/i18n/en.ts`
      are byte-identical, and `i18n.test.ts` and `render.test.tsx` pass.
- [ ] `src/net/room.ts` is still the only file under `src/` that imports `trystero` and still
      contains no timer of its own; `src/test/invariants.test.ts` is green and unmodified.
- [ ] A comment in `src/net/room.ts` records _why_ the password is normalised at the same door as
      the id — the code is both name and password, so a raw password is a silent failure with no
      status to show for it — rather than restating what the call does.
- [ ] `CLAUDE.md`'s transport section names `normalizeRoomCode` as the one normaliser, beside the
      existing "A room's code is its name _and_ its password" paragraph.
- [ ] `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` are green.

## Assumptions

- **The requirement is read as "make it provably so", not "fix a break".** Entering the code in any
  case already reaches the same room on `main`; the reviewer should know that before reading a diff
  that adds no player-visible behaviour. If issue #56 was filed after a real failed join, the cause
  is **not** case — look at relay reachability, a `NET_VERSION` mismatch between the two builds
  (the version is in the room id, so mismatched peers cannot meet at all), or a mistyped character
  — and this spec does not address any of those.
- **Upper case is the canonical form.** It is what `makeSeed()` emits and what `roomIdFor` has
  always folded to. Lower case was not considered; changing it would move every existing room id.
- **Normalisation is case and surrounding whitespace only.** Interior spaces, dashes and confusable
  characters (O/0, I/1/l) are neither stripped nor mapped. `makeSeed()` never emits the confusable
  ones, so a code read out correctly cannot need it.
- **The input field keeps showing exactly what the player typed.** No `text-transform`, no
  rewriting `value` on change. The canonical code is what the banner shows once the room is entered.
- **No version bump of any kind**, on the argument written into the criterion above. If the
  implementer finds a reachable caller that does pass a non-canonical code, that argument is void
  and the change needs a `NET_VERSION` bump — say so rather than shipping the bump silently.
- **`Room.code` becoming canonical is treated as safe** because nothing reads it: `useNetGame`
  tracks the code in its own `setRoom(code)` and never reaches for `roomRef.current.code`. If that
  stops being true the two must still agree, which is the point of normalising in one place.

## Touch points

- `src/net/room.ts` — new exported `normalizeRoomCode`; `roomIdFor` and `openRoom` both go through
  it; `openRoom` uses it for `password`, for `roomIdFor(...)` and for the returned `Room.code`; the
  why-comment.
- `src/hooks/useNetGame.ts` — `enterRoom` (~line 414) imports and calls `normalizeRoomCode` instead
  of spelling `raw.trim().toUpperCase()`; its existing comment about the name-and-password reason
  survives, pointing at the shared function.
- `src/net/room.test.ts` — the password and canonical-`Room.code` cases, beside the two `roomIdFor`
  cases already there.
- `src/hooks/useNetGame.test.tsx` — the mixed-case `enterRoom` case; the `vi.mock("../net/room", …)`
  factory gains `normalizeRoomCode`.
- `CLAUDE.md` — one line in the transport section.

## Out of scope

- Any visual change to the `#roomcode` field in `src/components/screens/Lobby.tsx`: no
  `text-transform`, no auto-uppercasing as the player types, no `maxLength`, no shape validation.
  The component is expected to be unchanged by this spec.
- A new catalogue line reassuring the player that case does not matter. `lobby.roomHint` stays as
  it is; the behaviour is the requirement, and a redundant sentence is a text decision nobody asked
  for.
- Refusing an empty or malformed code before `enterRoom` runs. Join is gated on the display name
  alone today, and that stays.
- The code-swap invitation code and the `#j=` hash, which are case-**sensitive** by construction —
  they carry an ICE ufrag, an ICE password and a fingerprint, where case is data, not spelling.
- Treating the code as a credential. It is a name and a password, anyone holding it can take an
  open chair, and that is unchanged (`docs/specs/2026-09-08-trystero-rooms.md`).
- Reconnect, late joining, seating and the roster — `docs/specs/2026-09-19-guest-reconnect-mid-match.md`
  and `docs/specs/2026-09-11-room-first-multiplayer-lobby.md` own those, and a returning guest
  re-enters through the room object it already holds rather than by typing a code again.
- Diagnosing an unreachable relay in the UI, and the unmeasured two-network NAT traversal gap.
  Both stay recorded in `CLAUDE.md` as known gaps.
