---
id: 2026-09-15-move-lobby-connection-texts-into-room
title: Draw the connection explanation where a session exists, not on the lobby's first page
kind: ui
status: proposed
---

# Draw the connection explanation where a session exists, not on the lobby's first page

## What

The lobby's first page — **Set the table**, the one a player lands on before a room is opened or
joined — stops explaining how the connection works. The two paragraphs that explain it,
`lobby.readable` ("no server… every machine holds every hand") and `lobby.roomRelay` ("A room
introduces the browsers over public Nostr relays…"), move to the pages where a session actually
exists and this window is in it: the **host's room page** (`net.role === "host" && net.room`) and
the **guest's or shared table's waiting page** (`net.role === "guest" || net.role === "table"`).
The first page is left as a name, a mode and the four ways out.

No catalogue string changes, no key is added or removed, no button moves, and nothing about the
transport changes: `NET_VERSION` stays **6**, `SAVE_VERSION` stays **3**, and `SCOPE`, `hashState`
and `parseMsg` are untouched.

## The requirement named a third text that does not exist, and two controls that do not either

Stated here rather than left for the implementer to discover, because the requirement was written
against an older tree.

- **`lobby.startNote` is gone from both catalogues.** It was deleted with the first page's Start by
  [2026-09-14-single-player-separate-from-multiplayer](2026-09-14-single-player-separate-from-multiplayer.md)
  — CLAUDE.md records it as "That page's Start went with it, and `lobby.startNote` with that."
  `grep -rn startNote src/` finds nothing. That third of the requirement is **already delivered, by
  deletion**; this spec does not recreate the key, the text or a home for it.
- **The chair picks (me / open / ai) and the solo "Start match" on that page are also gone**, so
  the requirement's "do not change them" is satisfied with no work: the picker went with the
  room-first roster and the Start went to the single-player screen. Nothing is restored here.

What is left to do is real: `lobby.readable` and `lobby.roomRelay` are still drawn on the first
page, at `Lobby.tsx` lines 674–675.

## Acceptance criteria

- [ ] The lobby's first page — `loadedState({ menu: "lobby" })` with the default off-session net —
      renders neither `translate(loc, "lobby.readable")` nor `translate(loc, "lobby.roomRelay")`,
      for every `loc` in `LOCALE_ORDER`.
- [ ] That page is otherwise unchanged: `render.test.tsx`'s existing _"picks no chair before a room
      exists"_ passes without edit — `.roominput`, `.lobbymode`, one `btn.openRoom`, no `.seatpick`,
      no dispatch — and `btn.joinGame`, `btn.otherWays` and `btn.back` are still its other three
      footer buttons.
- [ ] A host in a room (`stubNet({ role: "host", live: true, room: ROOM, … })`) renders
      `lobby.readable` and `lobby.roomRelay` exactly once each, in both locales.
- [ ] On that page both paragraphs are drawn **below** the click's own content: in
      `container.textContent`, the index of `lobby.readable` is greater than the index of
      `lobby.othersHere`, of the last `.seatpicks` block's text and of the `lobby.mode` heading.
      This keeps the ordering
      [2026-09-13-room-lobby-honest-ready-signal](2026-09-13-room-lobby-honest-ready-signal.md)
      delivered — readiness first, roster and chair assignment next.
- [ ] A guest in a room (`role: "guest"`, `room: ROOM`, seated and unseated alike) and the shared
      table (`role: "table"`, `room: ROOM`) each render both paragraphs, after the status line
      (`lobby.roomWait` / `lobby.seated` / `lobby.tableSeated` / `lobby.tableWaiting`) and before
      the `.lobbyfoot` element.
- [ ] A guest or table with **no room** (`room: null`, the code-swap route) renders
      `lobby.readable` and **not** `lobby.roomRelay`, in both locales: there is no room and no
      relay on that route, and the sentence would be false.
- [ ] Neither string appears on the room-code entry page (reached by `joinPage()`), on the
      `OtherWays` page, or on the code-swap host page (`role: "host"`, `room: null`) — asserted for
      both locales.
- [ ] Neither catalogue is touched: `git diff` reports no change under `src/i18n/`. No
      `lobby.startNote` is reintroduced, and `i18n.test.ts` passes unchanged.
- [ ] No new CSS: the paragraphs are plain `<p className="dek">` siblings with **no wrapper
      element** — the `.railpage` trap — and `src/index.css` is unchanged.
- [ ] `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` all pass.
- [ ] Measured in Chrome over CDP at **1280×500** and **390×844**, on the host's room page and on a
      guest's waiting page: no page scroll outside `.overlay`, and every `.lobbyfoot` button
      returns itself from `elementFromPoint` at its own centre. Record the readings in the pull
      request.
- [ ] CLAUDE.md's lobby section says where the connection prose is drawn and why it is not on the
      first page. No other document claims otherwise.

## Assumptions

Nobody answered a question during this run. Each of these is a reading that was chosen, and a
reviewer who disagrees with one should say so before the diff is merged.

- **`lobby.startNote` is not recreated.** The requirement lists it as one of three lines on the
  first page; it exists in neither catalogue and has not since 14 September. Recreating a deleted
  string to then move it would reverse a delivered decision by accident.
- **`lobby.roomRelay` is drawn only where `net.room !== null`.** The guest/table branch serves the
  code swap as well as the room, and on the code swap there is no room and no Nostr relay — a page
  that said otherwise would be a control that lies in prose. `lobby.readable` has no such clause:
  hand visibility is true of both routes.
- **The code-swap host page gains neither line, and this is the assumption most likely to be
  wrong.** The requirement enumerated two branches, so only those two are changed. The consequence
  is a real loss: a host who runs a code swap reads "every machine holds every hand" on the first
  page today and afterwards reads it only in the Rules panel (`rules.mp`, second entry). If that is
  not wanted, the fix is one `<p className="dek">{t("lobby.readable")}</p>` on the host's table
  page; it is deliberately not in this diff.
- **The order of the two paragraphs is preserved** — `readable`, then `roomRelay` — as on the first
  page today.
- **On the host's room page they go last, under the mode picker**, rather than under the room code
  where the eye lands first. The panel scrolls at a 500 px window and the readiness lines, the
  roster and the chair assignment are what the click needs; an explanation drawn above them pushes
  them under the fold, which is the failure `#declpanel` and the shop's replace picker each had.
  Whether they sit immediately before or immediately after the `roomEscape` block is the
  implementer's, as long as the ordering criterion holds.
- **The shared table sees them too.** The requirement names the table branch, and both lines are
  informational text, not a control — `MoveButton`'s rule is untouched and nothing new is
  clickable.
- **Nothing on the wire moves.** No `SCOPE` member, no `hashState` field, no `NetMsg` and no
  version: a peer on this build and a peer on the previous one differ only in which page draws two
  paragraphs.
- **This spec contradicts no delivered spec.** It overlaps
  [2026-09-14-single-player-separate-from-multiplayer](2026-09-14-single-player-separate-from-multiplayer.md),
  whose criterion that `lobby.readable` and `lobby.roomRelay` never leak onto the single-player
  screen stays true and whose test stays as it is; it overlaps
  [2026-09-13-room-lobby-honest-ready-signal](2026-09-13-room-lobby-honest-ready-signal.md), whose
  ordering on the host's room page is preserved by the fourth criterion above; and the sentence
  itself comes from [2026-09-08-trystero-rooms](2026-09-08-trystero-rooms.md), which said the lobby
  must state that a room's relay is a third party — it still does, one page later.

## Touch points

- `src/components/screens/Lobby.tsx` — remove the two `<p className="dek">` lines from the final
  ("the table, before anyone is invited") return, and the explanatory comment above them if it
  refers to them; add them to the `net.role === "host" && net.room` branch below `<ModePick />`,
  and to the `net.role === "guest" || net.role === "table"` branch below the status paragraph, with
  `net.room && …` guarding `lobby.roomRelay` there. Comments say **why** the room clause exists.
- `src/test/render.test.tsx` — the lobby block: a case for the first page's absence, one for the
  host room page's presence and ordering, one for the guest and the table in a room, one for the
  code-swap guest's missing relay line, and the negative sweep over `joinPage()`, `OtherWays` and
  the code-swap host page. Reuse `labelled`, `press`, `joinPage`, `hostingNet`, `inRoom` and
  `stubNet` rather than building new fixtures.
- `CLAUDE.md` — the lobby paragraph that currently reads "the setup page is a name, a mode and the
  ways out": say that the connection prose is drawn where a session exists, and that the code-swap
  host page deliberately carries neither line.

## Out of scope

- Recreating `lobby.startNote`, or any text on the first page to replace what leaves it.
- Restoring a chair picker or a Start button on the first page. Both were removed deliberately and
  stay removed.
- Drawing either line on the code-swap host page or on the `OtherWays` page — see the assumption
  that names the loss.
- Rewording any catalogue string, in either language, including `rules.mp`'s multiplayer entries
  and `lobby.dek`.
- Scoping `net.lan` to the route its switch is drawn on. That is a `useNetGame` change, it is a
  named wart in CLAUDE.md, and it is not this.
- Anything under `src/net/` or `src/game/`: no `NET_VERSION`, `SAVE_VERSION`, `SCOPE`, `hashState`
  or `parseMsg` change, and no reducer or schedule change.
- Layout work on the lobby beyond the two measurements the criteria ask for — no new CSS class, no
  change to `.lobbyfoot`'s stickiness.

## Verification

- `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
  `npm test` (2,259 tests) and `npm run build` pass. `git diff` reports no change under
  `src/i18n/` and none to `src/index.css`.

### The layout measurement, and which browser made it

Driven over the DevTools protocol against `npm run dev`, with `Emulation.setDeviceMetricsOverride`
and `element.click()`, on the two pages the two paragraphs moved to: the **host's room page**
(Multiplayer → a name → Open a room) and a **guest's waiting page** (Multiplayer → Join a game → a
name and a room code → Join a room). Both paragraphs were confirmed present on both pages in the
same reading before the geometry was taken.

**No Google Chrome is installed on the machine this was measured on**, so the browser was headless
**Microsoft Edge 153.0.4234.32** — the same Chromium and the same protocol, and the criterion's
"Chrome over CDP" is read as Chromium over CDP. A Blink layout figure is not expected to differ
between the two builds, but the substitution is recorded rather than hidden.

| Page            | Size     | `document.documentElement` scroll/client | `window.scrollY` | `.overlay` scroll/client | `.lobbyfoot` buttons                   |
| --------------- | -------- | ---------------------------------------- | ---------------- | ------------------------ | -------------------------------------- |
| Host, in a room | 1280×500 | 500 / 500                                | 0                | 1074 / 500               | Start alone 434, Hang up 436, Back 436 |
| Guest, waiting  | 1280×500 | 500 / 500                                | 0                | 526 / 500                | Hang up 438, Back 438                  |
| Host, in a room | 390×844  | 844 / 844                                | 0                | 1305 / 844               | Start alone 732, Hang up 734, Back 788 |
| Guest, waiting  | 390×844  | 844 / 844                                | 0                | 844 / 844                | Hang up 639, Back 639                  |

`scrollHeight === clientHeight` with `scrollY` at 0 on all four: **no page scroll outside
`.overlay`**, which is the only scroller — it does scroll on the host's room page, as it did before
the move. **Every `.lobbyfoot` button returned itself** from `document.elementFromPoint` at its own
centre in all four readings (the button top is listed above; the sticky footer keeps them on
screen), so no button is covered by the prose that arrived above it.

The probe was a throwaway script, not added to the tree — jsdom lays nothing out, so `npm test` is
not where this is proven.
