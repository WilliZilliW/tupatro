---
id: 2026-09-23-rps-two-player-multiplayer
title: Play Rock-Paper-Scissors against a second person through the lobby
kind: rule
status: proposed
source: >
  Rock-Paper-Scissors is a **two-player** game in its only source — Official WRPSA Rock Paper
  Scissors Rules v1.0 (<https://wrpsa.com/rules>) — and both players throw **simultaneously**, which
  is the one clause this spec actually implements: neither throw may be visible to the other player
  before both are committed. Everything else about tupatro's version of the mode (suits as throws,
  aluminium foil, the two club honours, Sofia, twelve rounds, no replayed tie) remains this game's
  own house rule with no source, exactly as `2026-09-19-card-based-rock-paper-scissors` records.
  Neither tuppi source knows the mode at all — the Oulunsalo senior tuppi club rule sheet (Antti
  Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi> describe a four-handed trick-taking
  game built on the rami/nolo declaration. See **Source** below.
---

# Play Rock-Paper-Scissors against a second person through the lobby

## What

Rock - Paper - Scissors - Aluminium Foil becomes a mode two people can play against each other from
two browsers. It appears in the lobby's mode picker beside Multiplayer Tupatro, the Race and
Traditional Tuppi; a host opens a room, one other player joins, and each of them is dealt twelve
cards and clicks one per round. Neither card is visible to anybody — not even to the player who
committed it — until **both** are committed, and then both turn together exactly as they do today.

Played alone the mode does not change at all: an empty opponent chair is the game's, its card is
still drawn from the run's own seeded `Rng` before the player can act, and every existing round,
score, result screen and board row behaves byte-identically.

## Prior specs and documents

- **Reverses three named lines of `2026-09-18-rock-paper-scissors-mode` and
  `2026-09-19-card-based-rock-paper-scissors` (both delivered), and the reversal is the whole
  point of this spec.** Those two put "a second human playing RPS" and "the lobby, the wire and the
  shared table: no `LOBBY_MODES` entry, no `NetMsg`, no `hashState` field, no `NET_VERSION` bump"
  under **Out of scope**, and criterion 7 of the earlier one requires `revealRps` to refuse the
  seat `rpsFoe` is "even if that seat is human" — a test of exactly that name stands in
  `src/game/reducer.test.ts`. **This spec wins over all three**, because the requirement asks for
  precisely the thing they excluded. Nothing else in either spec is reversed: the throw table, the
  honours, Sofia, `RPS_ROUNDS`, the deck, the board and the single-player row all stand. Both
  documents should be marked `superseded` **only in those clauses** — leave their `status` alone and
  add a pointer line, since the rest of each is still the mode's contract.
- **Overlaps `2026-09-08-race-starts-from-the-lobby`, `2026-09-08-traditional-tuppi-multiplayer-mode`
  and `2026-09-16-tupatro-match-mode-with-consumables` (all delivered) and copies their shape
  without touching them.** Those three put a `MatchId` in `LOBBY_MODES`. Rock-Paper-Scissors is
  deliberately **not** a `MatchId` — it banks no scale, has no point target and files a `RpsRow`
  rather than a `RaceRow` — so this spec widens the lobby's own type rather than widening `MatchId`.
  See the first assumption.
- **Overlaps `2026-09-11-room-first-multiplayer-lobby` and `2026-09-13-room-lobby-honest-ready-signal`
  (delivered) and reverses neither.** `net.canStart` stays seating only; what changes is how many
  chairs the room offers to assign while the mode is Rock-Paper-Scissors.
- **Overlaps `2026-09-08-shared-table-view-multiplayer` and
  `2026-09-19-private-table-layout-hand-placement` (delivered).** A display can type a room code
  whatever the mode is, so `PrivateTable` gains an arm for this mode rather than this spec
  pretending a display cannot arrive. Nothing about the display's read-only rule changes.
- **Overlaps `2026-09-19-guest-reconnect-mid-match` (delivered) and gets its benefit for free.**
  `hostSession`'s resume log is per-action and mode-blind, so a guest whose link drops mid-match in
  a room comes back into a Rock-Paper-Scissors match through the same `resume`/`catchup` path. No
  code and no criterion here; it is named so a reviewer does not read its absence as an omission.
- **Overlaps `2026-09-14-per-challenge-continue` (delivered) and changes nothing.** The mode still
  reaches no screen before its result, so it still writes no snapshot — and a networked run is
  never written at all.
- Nothing here is already delivered: `grep -n "rps" src/components/screens/Lobby.tsx` finds nothing
  today, `LOBBY_MODES` is `["tupatro", "race", "tuppi"]`, and the reducer's `revealRps` case opens
  with `if (p === rpsFoe(d)) return;`.

## Acceptance criteria

- [ ] **The mode is in the lobby's picker, through a type of the lobby's own.** `src/game/types.ts`
      gains `export type LobbyId = MatchId | "rps"`; `LOBBY_MODES` in `Lobby.tsx` is
      `["tupatro", "race", "tuppi", "rps"]` typed `LobbyId[]`; `Net.match` / `Net.setMatch` in
      `hooks/netContext.ts`, the `useState` in `useNetGame.ts` and `stubNet` in `src/test/harness.tsx`
      all move from `MatchId` to `LobbyId`. `MatchId` itself is **unchanged**, and
      `matchModeOf("rps")` still returns `null`. `ModePick`'s best-result line branches: `"rps"`
      reads `readRpsScores()[0]` and renders `rps.bestWon`, every other id keeps
      `readRaceScores(m)` and `race.bestWon` — passing `"rps"` to `readRaceScores` is a compile
      error after the branch exists. `render.test.tsx` finds the fourth picker button
      (`[data-mode="rps"]`) on the host's room page in both locales.
- [ ] **`rpsSeats(g): [Seat, Seat]` replaces the assumption that the opponent is always
      `ownerSeat + 1`.** In `src/game/rps.ts`: the first element is `ownerSeat(g)`; the second is the
      other `"human"` seat when **exactly two** seats are `"human"` and `teamOf` differs between
      them, and `(ownerSeat(g) + 1) % 4` otherwise. `rpsFoe(g)` stays exported as
      `rpsSeats(g)[1]` so no call site has to change shape. `rps.test.ts` pins all five
      arrangements: single human at each of the four seats (`[p, p+1]`), humans at `(0,1)`,
      `(3,0)` → `[0, 3]`, humans at `(0,2)` — same team — falling back to `[0, 1]`, and an all-AI
      board answering `[0, 1]`. The function reads `g.seats` alone and consumes no randomness.
- [ ] **A human opponent's card is never drawn by the game.** `startDeal`'s `"rps"` arm and
      `resolveRps`'s next-round branch both call `drawRpsFoeCard` only when
      `d.seats[foe] !== "human"`, where `foe` is `rpsSeats(d)[1]`. A `reducer.test.ts` case starts a
      two-human `"rps"` board and asserts `d.rpsCards` is `[null, null]` after `startChallenge`, and
      that `d.rngState` is **unchanged** by twelve complete rounds after the opening shuffle — no
      `pick` is spent per round. A second case starts a single-human board and asserts the opponent's
      slot is filled at round start and `rngState` moves exactly as it does today.
- [ ] **Either of the two playing seats may reveal, and the round turns only when both have.**
      `revealRps`'s `if (p === rpsFoe(d)) return;` guard is replaced by "`p` must be one of
      `rpsSeats(d)`"; every other guard stays (`d.seats[p] === "human"`, `d.phase === "rpsthrow"`,
      that seat's slot is still null, the uid is in that seat's hand, identity by `uid`). The card
      is moved into `d.rpsCards[teamOf(p)]` and the phase becomes `"rpsreveal"` **only when both
      entries of `d.rpsCards` are non-null**. `reducer.test.ts` reaches each refusal directly, plays
      a two-human round in **both** commit orders and asserts the phase stays `"rpsthrow"` after the
      first commit and flips after the second, and asserts a single-human round still flips on the
      one click. **The delivered test named "refuses a reveal from the seat rpsFoe is, even if that
      seat is human" is deleted and replaced by one asserting the opposite** — see Assumptions.
- [ ] **A committed card is hidden from its own player too, and the felt says so.** `RpsTable`
      draws, for each of the two sides independently: `.rpsslot` (the empty outline) while that side
      has not committed, `.rpscardback` once that side's `rpsCards` entry is non-null while
      `g.phase === "rpsthrow"`, and the `Turned` card once the phase is `"rpsreveal"` — so the
      player who has committed sees a back, not their own card. The outcome line reads a new
      `rps.waiting` while this seat has committed and the other has not, `rps.choosing` while this
      seat has not, and the round's verdict when revealed. `Hand.tsx`'s `"rps"` branch stops drawing
      its cards as `playable` and dispatches nothing once `g.rpsCards[teamOf(you)] !== null`, and
      `Hint` returns `hint.rpsWait` in that state. `render.test.tsx` asserts, in both locales, that
      a state with only the viewing seat's card committed renders **no** rank or suit text belonging
      to that card anywhere in the tree.
- [ ] **The result screen stops being written from the run owner's point of view.** The `rpsover`
      `Screen` in `types.ts` becomes `{ kind: "rpsover"; winner: 0 | 1 | "draw"; wins: [number, number] }`
      — `result` is gone — `showRpsOver` stores `rpsWinner(d.rpsWins)` and no longer calls
      `ownerTeam`, and `screens/RpsOver.tsx` derives won/lost/drawn and orders the two totals from
      `teamOf(useViewSeat())`. `render.test.tsx` renders one and the same `rpsover` payload at both
      playing seats and asserts one window reads `rpsOver.won` and the other `rpsOver.lost`, with a
      drawn payload reading `rpsOver.drawn` at both.
- [ ] **The lobby seats exactly the two chairs the mode plays, on both routes.** While
      `net.match === "rps"`: the room host's chair-assignment list in `Lobby.tsx` draws chairs 0 and
      1 only, a line (`lobby.rpsTwo`) says the mode seats two, and `planFor` in `useNetGame.ts`
      opens chair 1 alone (chairs 2 and 3 stay `"ai"`) so `invite()` builds one chair invitation
      plus the chairless display link. `net.canStart` is **not** changed — a room holding a third
      unassigned player simply cannot satisfy it, and `lobby.needAssignments` plus `lobby.rpsTwo`
      are what explain that. `useNetGame.test.tsx` asserts the one-chair plan and that `seatsFor()`
      answers `["human", "human", "ai", "ai"]` once chair 1 is connected and
      `["human", "ai", "ai", "ai"]` while it is not.
- [ ] **A shared display shows the mode instead of an empty frame.** The board markup inside
      `RpsTable` is extracted into an `RpsBoard` component in the same file; `RpsTable` wraps it in
      `.tablewrap > .felt` as now, and `PrivateTable` draws `<RpsBoard />` inside `.privstage` in
      place of `<ModeBox />` and `<Panels />` when `g.challenge === "rps"`, with `<Hand />` beneath
      it unchanged. `render.test.tsx` renders a player window with `net.tableHere` true in an
      `"rps"` match and asserts the round line, both slots and the score are present, and renders
      the display's own window and asserts no hand is drawn.
- [ ] **The wire carries the mode honestly, and an older peer cannot meet a newer one.**
      `NET_VERSION` in `src/net/protocol.ts` goes to **12**, with a comment saying why (a v11 peer's
      reducer refuses a reveal from the opponent seat and draws that opponent's card from the
      `Rng`, so the first round of a two-human match diverges `rngState`, one hand and `rpsWins` on
      that peer alone). `hashState` gains `g.rpsRound`, `g.rpsWins.join("/")` and
      `g.rpsCards.map((c) => c?.uid ?? "-").join(",")`, and both `hashing.due` sites in
      `src/net/session.ts` set the flag for `resolveRps` as well as `endTrick`, so a
      Rock-Paper-Scissors match compares hashes at all. `SCOPE`, `guestMay`, `scopeOf`, `parseMsg`
      and the `NetMsg` union are **byte-identical** — `revealRps` is already `"seat"` and
      `guestMay` already admits it for the sender's own chair. `protocol.test.ts` pins the version,
      the three new hash inputs and the unchanged `SCOPE`/exception-list length.
- [ ] **Single player is untouched, and that is asserted rather than assumed.** `SOLO_MODES` in
      `SinglePlayer.tsx` still carries `"rps"`, its `PositionLine` and `BestLine` branches are
      unchanged, `readChallengeRun("rps")` still answers null mid-match, and `GameContext.tsx`'s
      `rpsover` branch still files a row only when `net.live` is false. A `reducer.test.ts` golden
      plays a whole single-human match for a fixed seed and asserts the **same** final `rpsWins`,
      `rpsRound` and `rngState` as the same seed produces on `origin/main`, and
      `game/seats.test.ts`'s pinned literals and 50-seed aggregate do not move.
- [ ] **Text and docs.** Both catalogues gain `rps.waiting`, `hint.rpsWait` and `lobby.rpsTwo` with
      matching placeholder sets, `challenge.rps.t` is amended to say the second player may be a
      person, no player-facing literal appears outside `src/i18n/`, and every number goes through
      `fmt()`. `components/screens/Rules.tsx` says the mode is playable by two people from the
      lobby and that both cards stay hidden until both are committed; `README.md`'s
      Rock-Paper-Scissors section says the same and states that the measured throw-share sweep
      covers the solo path only; `CLAUDE.md`'s Rock-Paper-Scissors paragraph, its `LOBBY_MODES`
      sentences, its `NET_VERSION` list and its "single player only" line are all corrected.
      `SAVE_VERSION` stays **3** and `RPS_SCORES_VERSION` stays **2**.
- [ ] **The gates pass.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build`, with the
      full test count reported in the pull request body.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The delivered refusal is reversed on purpose, and a passing test is deleted to do it.**
  `src/game/reducer.test.ts`'s _"refuses a reveal from the seat `rpsFoe` is, even if that seat is
  human"_ is the delivered contract of `2026-09-19-card-based-rock-paper-scissors`, criterion 7. The
  requirement asks for exactly the behaviour that test forbids, so the test is replaced rather than
  worked around. **This is a reversal a human must see**, and it is the reason this spec exists;
  nothing else in that spec is touched.
- **`"rps"` does not become a `MatchId`, and the lobby gets a type of its own.** `MatchId` means "a
  mode that banks a scale against a target and files a `RaceRow` on its own `tupatro-<id>-v1` key" —
  `matchModeOf`, `readRaceScores`, `MatchPlate`, `RaceOver` and `SinglePlayer`'s `PositionLine` all
  read it that way, and widening it would silently make every one of them treat a twelve-round
  best-of as a race. `LobbyId = MatchId | "rps"` keeps the roguelike a compile error in the picker,
  which is what `MatchId` was there for, and costs one branch in `ModePick`.
- **The two chairs are 0 and 1, decided by the lobby rather than by the player.** Nothing in the
  room's roster UI stops a host seating two people as partners, and two humans on the **same** team
  cannot play this mode at all: `rpsCards` and `rpsWins` are team-indexed, so both would write the
  same slot. Rather than gate Start on adjacency and make the host work it out, the lobby offers two
  chairs and the pair is `(0, 1)` by construction. Which of the two a given player holds does not
  matter: `ownerSeat` is the lower human index either way, every plate and the felt are
  viewer-relative, and this spec makes the result screen viewer-relative too.
- **`rpsSeats` still has a same-team fallback, and it is a soft failure rather than a stall.** A
  hand-built or future plan seating two humans at 0 and 2 answers `[0, 1]`: seat 0 plays the game's
  own draw at chair 1, and the human at chair 2 sits with a hand it cannot commit. That is the same
  runtime-guard-not-type shape `startChallenge`'s all-AI board already has. It is not reachable from
  the lobby after this spec, and it is written down rather than thrown, because throwing inside the
  reducer kills the deal.
- **A networked Rock-Paper-Scissors match files no row on anybody's board, and that is inherited,
  not decided here.** `GameContext.tsx` returns before every board write while `net.live`, exactly
  as it does for a networked race. Both players finish on `RpsOver` with the correct result and
  neither `tupatro-rps-v1` gains a row. Fixing that needs the window's own seat inside a pure scores
  function and is the same gap CLAUDE.md already records for the race.
- **Neither player's committed card is on their own screen, and that is a stronger reading than
  "the opponent cannot see it".** The requirement says both stay hidden until both have committed;
  the simplest reading — hide only from the opponent — would let one player look at their own card
  and change nothing, but it also makes the two windows draw different things for the same state,
  which is exactly the class of bug the hash exists to catch. Hiding both is one rule, one code path
  and identical on both screens. The cost is that a player cannot re-read what they picked while
  waiting; the hand shows which card is gone, which is judged enough.
- **`rpsCards` and `rpsWins` stay team-indexed.** Indexing by "the two playing seats in order" would
  remove the adjacency constraint entirely and is the theoretically cleaner answer, but it moves
  `resolveRps`, `showRpsOver`, `rpsRowFor`, `RpsTable`, `RpsPlate` and `SinglePlayer`'s two lines
  at once, and every existing test that reads `teamOf(rpsFoe(g))`. Team-indexing plus a two-chair
  lobby is the smaller change with the same outcome.
- **The shared display is supported rather than refused.** A display types the room's eight
  characters like anybody else and no per-mode refusal exists anywhere in `hostSession`, so leaving
  `PrivateTable` without an arm would leave both players staring at a frame with no round, no score
  and no opponent slot the moment a display joined. The arm is small because the mode's felt holds
  nothing private — the hand is the only secret, and `PrivateTable` already moves it.
- **No new AFK handling, no per-round timer and no "your opponent left" notice.** A player who
  commits nothing stalls the round for ever, exactly as a player who plays no card stalls a tuppi
  trick today. That is the existing gap CLAUDE.md records under Known gaps, and this mode inherits
  it rather than solving it first.
- **No balance measurement is run, and that is a claim rather than an omission.** The mode's only
  measured figure is the throw-share sweep over uniform reveals, and the single-human path is
  byte-identical after this change — the AI-foe draw is gated on `d.seats[foe] !== "human"`, which
  is false in every solo board. Against a person the throw distribution is the people's, and there
  is no lever to tune. The README will say the sweep covers the solo path only.
- **The mode stays offered in single player too.** The requirement adds a route; it does not ask for
  one to be removed, and `SOLO_MODES` already draws the row.
- **`rps.opponent` still reads "Opponent" rather than the other player's character name.** Naming
  the seat through `seatName` would be nicer with a person behind it and is one line, but it makes
  the label mode-dependent in a component that has no seat argument today, and "Opponent" is true in
  both cases. Out of scope below.

## Touch points

- `src/game/types.ts` — `LobbyId`; the `rpsover` `Screen` payload (`winner` replaces `result`); the
  `rps*` field comments, which currently state the opponent is always `rpsFoe(g)` drawn by the game
- `src/game/rps.ts` — `rpsSeats`, `rpsFoe` in terms of it, and the comment block's two-player
  paragraph
- `src/game/rps.test.ts` — the five seat arrangements
- `src/game/reducer.ts` — `startDeal`'s `"rps"` arm and `resolveRps`'s next-round branch (the
  `d.seats[foe] !== "human"` gate on `drawRpsFoeCard`), the `revealRps` case's guards and its
  both-committed phase flip, `showRpsOver`'s neutral payload
- `src/game/reducer.test.ts` — the reversed refusal, both commit orders, the no-RNG-per-round case,
  the single-human golden
- `src/game/schedule.ts` — `waitingSeat`'s `rpsthrow` arm: the first seat of `rpsSeats(g)` that is
  `"human"` and has not committed. `nextTick`'s two arms are unchanged
- `src/net/protocol.ts` — `NET_VERSION` 12, the three new `hashState` inputs
- `src/net/session.ts` — both `hashing.due` sites
- `src/net/protocol.test.ts` — the version, the hash inputs, `SCOPE` unchanged
- `src/hooks/netContext.ts`, `src/hooks/useNetGame.ts` — `match`/`setMatch` typed `LobbyId`;
  `planFor`'s one-open-chair plan for `"rps"`
- `src/hooks/useNetGame.test.tsx` — the plan and `seatsFor()`
- `src/components/screens/Lobby.tsx` — `LOBBY_MODES`, `ModePick`'s best-line branch, the two-chair
  assignment list and `lobby.rpsTwo`
- `src/components/table/RpsTable.tsx` — the extracted `RpsBoard`, the per-side slot rule, the
  waiting line
- `src/components/table/PrivateTable.tsx` — the `"rps"` arm
- `src/components/screens/RpsOver.tsx` — viewer-relative result and totals
- `src/components/hand/Hand.tsx`, `src/components/hand/Hint.tsx` — committed-state handling
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `rps.waiting`, `hint.rpsWait`, `lobby.rpsTwo`, amended
  `challenge.rps.t` and the `rules.rps*` lines
- `src/components/screens/Rules.tsx`, `README.md`, `CLAUDE.md`, `docs/multiplayer.md`
- `src/test/harness.tsx` (`stubNet.match`), `src/test/render.test.tsx`

## Out of scope

- Three or four people in one Rock-Paper-Scissors match, a per-seat scale, or any use of chairs 2
  and 3 in the mode.
- Making `"rps"` a `MatchId`, giving it a `RaceRow`, a target, a `raceDeal` counter or a place in
  `matchModeOf`'s non-null arms.
- Filing a board row for a networked match on either browser, and the `ownerTeam`-in-`rpsRowFor`
  gap that blocks it — the same gap the race already records.
- Offline pass-and-play: two humans on one board in this mode are reachable only from a hand-built
  state, and no screen offers it.
- An AFK timer, a "your opponent has left" notice, a forfeit, or announcing a departure to the other
  guests on the code-swap route.
- Naming the opponent's seat on the felt, the rail plate or the result screen instead of
  `rps.opponent`.
- Any change to the throw table, the two club honours, Sofia's rule, `RPS_ROUNDS`, `RPS_HAND`, the
  deck, the reveal animation timings, the `2600 ms` result delay or the board's sort order.
- A bot that saves its honours — still the obvious next spec, and still not this one.
- Any change to another mode's deal, to `scoreTrick`, `chooseAI`, `legalCards`, `currentWinner`, or
  to the 0.35 anti-sooli randomness.
- `SAVE_VERSION`, `RPS_SCORES_VERSION`, a snapshot at a phase boundary, resuming a
  Rock-Paper-Scissors match from disk, or a Continue row for it.
- New `NetMsg` members, `SCOPE` entries, `guestMay` clauses or `parseMsg` validation of challenge
  ids.

## Source

- **Official WRPSA Rock Paper Scissors Rules v1.0**, <https://wrpsa.com/rules> — the game is played
  **between two players** who deliver their throws **simultaneously**, on a shared count. The one
  clause this spec implements is the simultaneity: in a turn-based reducer that becomes "neither
  card is visible to anybody until both are committed", which is why the phase may not move to
  `rpsreveal` on the first commit. Write that reading into the comment above the `revealRps` case,
  because a phase that does not flip on a click looks like a missing line.
- **The WRPSA's replayed tie and first-to-two match remain overruled**, by
  `2026-09-19-card-based-rock-paper-scissors`'s own requirement: exactly `RPS_ROUNDS` rounds, a tie
  counts for neither side, a drawn match is a real outcome. This spec does not reopen that, and the
  existing comment above `resolveRps` stays.
- **Everything about tupatro's version of the mode is still house rule with no source**: suits as
  throws, aluminium foil as a fourth throw, the ♣K and ♣Q as honours, Sofia always losing, twelve
  cards and twelve rounds. `rps.ts`'s header comment already says so and must keep saying so.
- **The tuppi sources say nothing about this mode, and that is the finding.** The Oulunsalo senior
  tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>
  describe a four-handed, no-trump trick-taking game built on the rami/nolo declaration,
  _maantuntopakko_, sooli and _ryöstö_. Rule 4 — "tuppi's rules are never invented" — is about
  tuppi, and this mode makes no claim on tuppi's name. No tuppi term is used for any part of it,
  and the lobby's picker must not imply otherwise: it sits beside three tuppi match modes and its
  own `CHALLENGES` description is what distinguishes it.

## For the implementer: the traps in this codebase this change walks into

1. **`rpsCards` is team-indexed, so the two playing seats must be on different teams.**
   `teamOf(p) = p % 2` and partners sit **across**, so "next to each other" is the requirement and
   "opposite each other" is the mistake. Chairs 0 and 1 satisfy it; chairs 0 and 2 do not.
2. **`ownerSeat(g)` is `seats.indexOf("human")`, not "the host".** A host that assigns itself chair 1
   and its guest chair 0 makes the **guest** the run owner. Nothing may read "the owner" as "this
   window" — that is `myEcon` coming back — which is exactly why the `rpsover` payload has to stop
   carrying a viewer-relative `result`.
3. **The phase flip is the whole feature.** `d.phase = "rpsreveal"` must move inside a test on both
   slots. With an AI opponent the opponent's slot is already full, so the first click still flips it
   and every delivered single-player test keeps passing — that is the check that the condition is
   written correctly, not evidence that nothing changed.
4. **Do not gate the foe draw on `rpsSeats` alone.** The gate is `d.seats[foe] !== "human"`. A chair
   the lobby marked `"human"` because a peer connected must never have a card drawn for it, or the
   host and the guest write different cards into the same slot and the hash fires on the first
   comparison — which, before this spec's `session.ts` change, would never have happened at all.
5. **`hashing.due` is set by `endTrick` alone today, so a Rock-Paper-Scissors match currently
   compares no hashes ever.** Both sites in `session.ts` — the host's and the guest's — need
   `resolveRps`, or a divergence in this mode is silent for twelve rounds.
6. **`NET_VERSION` must move even though no message shape does.** `parseMsg`'s `isAction` does not
   validate challenge ids and the reducer rule itself changed, so a v11 peer joined into a v12
   match diverges on round one. The room id and the invitation code both carry the version, so the
   bump is what keeps the two builds from meeting.
7. **`render.test.tsx`'s `SCREENS` fixture is keyed off `Screen["kind"]` and Vitest does not
   type-check.** Changing the `rpsover` payload is caught by `npm run typecheck` and
   `npm run build`, not by `npm test`.
8. **A new catalogue key is a Finnish-first change.** Add it to `fi.ts`; `en.ts` will not compile
   until it has it too, and `i18n.test.ts` checks the placeholder sets match.
9. **`.rpsslot`, `.rpscardback` and `.card` are sized to match at every breakpoint** (see
   `index.css`'s two general steps and the short-felt block). Drawing a back where a slot used to be
   must not change any of the three, and the felt already clips at 360×640 in Finnish — measure
   there, in both languages, with a committed-but-unrevealed card on each side.
10. **`Panels()` draws nothing for `rpsthrow`**, deliberately, so there is no `#declpanel` to put a
    "waiting" line in. It belongs on the felt, in `RpsBoard`, where `PrivateTable` will also draw it.
