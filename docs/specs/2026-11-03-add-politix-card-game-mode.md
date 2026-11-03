---
id: 2026-11-03-add-politix-card-game-mode
title: Add Politix, a ninth single-player rule set ported from its own rule sheet, changing no existing mode
kind: rule
status: proposed
source: >
  Politix rule sheet, Touko Tahkokallio / Onni Games 2009, 6 pages
  (<https://lautapeliopas.fi/wp-content/uploads/2009/06/Politix_ohjeet.pdf>, read from a local copy
  of that PDF). **This mode is not tuppi** and neither tuppi source (the Oulunsalo senior tuppi club
  rule sheet, Antti Auer, 9 September 2022, and <https://korttipeliopas.fi/tuppi>) knows it. The
  sheet gives the turn structure, the taking rule, the special-card rules and the end and scoring
  rules; it does **not** give the card list, the deck counts, any politician's skills, any voter
  group's symbol counts beyond two worked examples, or three of the four events' effects. Those are
  this game's own data, named as such under Assumptions and in the rules panel.
---

# Add Politix, a ninth single-player rule set ported from its own rule sheet, changing no existing mode

## What

The single-player screen gains one row: **Politix**. Four seats play in two parties of two (the
player and the AI partner across the table against two AI opponents). On a turn a seat either
**draws three action cards** or **plays cards**: politicking cards of one tactic (plus wild
"coffee" cards) aimed at one voter group lying face up on the table, adding the politician's own
skill and any bonuses, to win one or more cards of that group for its party — and/or special cards
(group modifiers, burnout, yesterday's news) on any seat. Eight voter-group cards lie face up and
are refilled; events that surface change one tactic's strength for everyone. When the last
voter-group card leaves the table the game ends, and the party whose **weakest** voter group is
strongest wins. It ends on a result screen of its own with a board of its own.

**Nothing else moves.** The roguelike, Tuppi-Rummikub, the race, Traditional Tuppi, Multiplayer
Tupatro, both Nami variants, Rock-Paper-Scissors and Politiikka keep byte-identical behaviour,
saves, goldens, scoreboards and network protocol — the user's own words were _"älä muuta vanhoja
pelimuotoja mutta tuo tämä yksi lisää"_ ("do not change the old game modes, just bring this one in
addition"), and the criteria below make that checkable rather than promised.

## Prior specs and documents

- **Supersedes the unmerged branch `spec/2026-11-03-add-politix-game-mode`** (on `origin`, one
  commit `ef72fef` "Add Politix, the lobby-only politics match"), which put Politiikka's rules under
  a second id. That branch never reached `main`, has no spec in `docs/specs/` on `main`, and **nothing
  here reuses or builds on it** — the requirement says so explicitly. The human may want to delete
  it; this pipeline does not.
- **Does not touch `2026-09-19-politics-challenge-variant`, `2026-09-19-puoluepeli-party-mode`,
  `2026-09-20-combine-politics-modes` or `2026-09-25-improve-politics-card-look` (Politiikka, all
  delivered).** The names are close and the themes overlap; the games do not. Politiikka is tuppi
  trick play with a party-capture scale; Politix has no tricks, no `Card`s and no `PARTIES`. No
  Politiikka file, key, board (`tupatro-politiikka-v2`), constant or CSS rule changes. `PARTIES`,
  `governmentFor`, `isSofia` and the party emblems are **not** reused, so Politiikka can never be
  moved by an edit made for Politix.
- **Follows `2026-09-18-rock-paper-scissors-mode` / `2026-09-19-card-based-rock-paper-scissors`
  (delivered) in shape**: a `ChallengeId` that is not a `MatchId`, a `startDeal` arm that returns
  before `dealCards`, its own phases, its own felt (`Table.tsx` branch), its own `Hand.tsx` branch,
  its own rail plate, its own result screen and board, no snapshot because no screen is reached
  before the result. It takes none of RPS's code or fields.
- **Does not extend `2026-09-23-rps-two-player-multiplayer`**: Politix is not in `LOBBY_MODES`.
  Putting it there would need a `NET_VERSION` bump, which changes every room id and invitation for
  every existing mode — the one thing the requirement forbids.
- **Overlaps `2026-09-14-per-challenge-continue` and gets nothing from it**, for the RPS reason: no
  screen before the result, so no `tupatro-run-politix-v1` snapshot is ever written.
- Nothing is already delivered: `grep -rni "politix" src/` finds nothing on `main`, and
  `ChallengeId` has eight members.

## Acceptance criteria

- [ ] **Existing modes are byte-identical, and the diff proves it.**
      `git diff origin/main -- src/game/seats.test.ts src/game/rps.ts src/game/politics.ts src/game/puolue.ts src/game/nami.ts src/game/points.ts src/game/race.ts src/game/laydown.ts src/game/scoring.ts src/game/rules.ts src/game/ai.ts src/game/economy.ts src/game/shop.ts src/net/session.ts src/net/room.ts src/net/seating.ts`
      is empty apart from `race.ts`'s exhaustive `matchModeOf` switch gaining
      `case "politix":` beside `"rps"` (returning `null`). `NET_VERSION`, `hashState`, `guestMay`,
      `parseMsg`, the `NetMsg` union, `LOBBY_MODES`, `SAVE_VERSION` (3), every existing storage key
      and every existing board version are unchanged. `npm test` passes with **no existing assertion
      edited** except the four extension points the sweeps are built to grow at:
      `render.test.tsx`'s spelled-out solo-id list, `PHASE_PANEL`, the `SCREENS` fixture, and
      `invariants.test.ts`'s `PURE_CORE`.
- [ ] **Saves of every other mode are byte-identical.** `GameState` gains exactly one field,
      `politix: PolitixState | null`, `null` from `createRun`. `"politix"` is added to `Dropped` /
      `DROPPED_KEYS` in `save.ts`, so `dehydrate` never writes the key; `rehydrate` returns `null`
      for any payload whose `challenge === "politix"` (no snapshot of this mode is ever valid,
      because none is ever written). `save.test.ts` asserts `"politix" in dehydrate(g)` is false for
      a main-run state and for a race state, and that a payload naming `challenge: "politix"` is
      rejected.
- [ ] **A ninth id, not a match, single-player only.** `ChallengeId` in `types.ts` is
      `"rummikub" | "rps" | "politix" | MatchId` with `MatchId` and `LobbyId` unchanged;
      `CHALLENGES` gains `{id:"politix", key:"challenge.politix", g:"X", deals:0, target:0}` (a
      letter, tofu-safe); `matchModeOf("politix") === null` is asserted; `SOLO_MODES` in
      `SinglePlayer.tsx` draws the row with no filter change; `LOBBY_MODES` is untouched. The
      render sweep finds the row in both locales.
- [ ] **`src/game/politix.ts` is the rule, the data lookups and the AI, and nothing else**, added
      to `PURE_CORE` and to `CLAUDE.md`'s module table. It exports at least
      `PX_TACTICS` (`"argue" | "evade" | "charm" | "growl"`), `PX_GROUPS` (six ids: farmers,
      workers, whitecollar, youth, blondes, hippies), `pxPower(g, p, group, tactic, cardUids)`,
      `pxTakeCount(power, need, onTable)` (= `power < need ? 0 : min(onTable, 1 + power - need)`),
      `pxLegalPlay(g, p, play): PxRefusal | null`, `pxWinner(collected, turns): 0 | 1 | "draw"`
      and `pxMove(g, p): Action` (the AI). It imports no React, no DOM, no `i18n`, no reducer, and
      draws randomness only through an `Rng` it is handed. The content tables (`PX_POLITICIANS`,
      `PX_GROUP_NEED`, `PX_EVENTS`, `PX_ACTION_DECK`) live in `content.ts` and carry no functions.
- [ ] **The sheet's rules, each pinned in `politix.test.ts` with the sheet's own worked examples.**
      Draw turn: 3 cards (`PX_DRAW`), 2 under burnout (`PX_BURNOUT_DRAW`); hand limit 10
      (`PX_HAND_MAX`) enforced at turn end; start hand 4 (`PX_START_HAND`); 8 face-up voter cards
      (`PX_TABLE`); 7 cards per voter group (`PX_GROUP_CARDS`) — each constant's comment cites the
      sheet page. Power = cards played of the chosen tactic + wild coffees played + the acting
      politician's skill in that tactic + the active event's modifier for that tactic + the group
      modifiers lying in front of the acting seat for that group + the acting party's symbol bonus
      for that group. **The sheet's page-4 example is a test**: skill +2 growl, recession event +1
      growl, a +1-youth special in front of the seat, one growl card played, youth needing 3 growl,
      three youth cards on the table → power 5, takes 3. A play of special cards only takes nothing;
      a play with politicking cards whose power is below the need is refused (`pxLegalPlay`); one
      group and one tactic per play; burnout only onto an opposing-party seat that has none;
      yesterday's news removes exactly one special from any seat and never a party symbol; resting
      under burnout costs the turn and discards the burnout; an empty draw pile is rebuilt by
      shuffling the discard pile through the run's `Rng`.
- [ ] **Scoring is the sheet's page-6 rule, and its worked example is a test.** Each party's
      per-group counts (zeros included, all six groups) are sorted ascending and compared
      lexicographically; the larger vector wins; equal vectors fall to the party with **fewer
      turns** (each member's turns summed, rest and draw turns included); equal turns too is
      `"draw"`. A test pins right `[6,5,4,2,2,1]` vs left `[6,5,5,3,2,1]` (the sheet's example,
      listed largest first) → left wins on the third-smallest group, plus a fewer-turns tie-break
      case and a draw case.
- [ ] **The game's data obeys stated constraints, tested rather than trusted.** Every voter group's
      four needs are a permutation of `[2, 3, 4, 5]`; every tactic is the cheapest (2) for at least
      one group; blondes need 3 charm and youth need 3 growl (the sheet's two stated figures).
      There are 8 original politicians; each one's four skills lie in `0..2` and sum to exactly 3,
      and no two are identical. The voter deck is 42 group cards + 4 events. The action deck is
      exactly 60 cards: 9 of each tactic, 6 wild coffees, one +1 and one −1 group modifier per group
      (12), 3 burnouts and 3 yesterday's news. The four events each move exactly one tactic by ±1,
      and the recession event is +1 growl (the sheet's one stated effect).
- [ ] **Setup and randomness go through the run's `Rng` and `uidSeq`, in state.** `startDeal`'s
      `d.challenge === "politix"` arm (id spelled out, never a truthiness test) sits before
      `dealCards` and returns from there: it deals four distinct politicians, shuffles both decks,
      deals 4 action cards to every seat, lays 8 voter cards shuffling any event drawn during setup
      back in, and draws the starting seat — all from `makeRng(d.rngState)` written back, with every
      action card's `uid` from `makeMint(d.uidSeq)` written back. `g.hands` stays four empty arrays.
      A test plays one seed twice with the same decisions and asserts identical `PolitixState` and
      `rngState` at the end; a second seed gives a different setup.
- [ ] **Two new phases, four touch points each, and no loop.** `Phase` gains `"pxturn"` and
      `"pxdiscard"`. `nextTick` returns `null` when `g.screen` is set, `null` for a human seat's
      turn, and an `aiPolitix { p }` tick (delay 900 ms) for an AI seat's, whose key carries
      `PolitixState.turnNo` and the phase so consecutive AI turns never share one; `waitingSeat`
      answers the seat to move when it is human; `Panels` returns `null` for both (the felt
      carries the controls, as for `rpsthrow`); `Hint` has a line for each (`hint.pxTurn`,
      `hint.pxWait`, `hint.pxDiscard`); neither joins `SPREAD_PHASES`; `PHASE_PANEL` lists both
      as `false`. A whole game driven through `drive.ts`'s `advance` with `pxMove` deciding for the
      human seat settles rather than throwing "did not settle".
- [ ] **Actions are seat-carrying, guarded, classified — and the wire is otherwise untouched.**
      `Action` gains `pxDraw {p}`, `pxRest {p}`,
      `pxPlay {p, group: PxGroup | null, tactic: PxTactic | null, cards: string[], specials: {uid: string; target: Seat; remove?: string}[]}`,
      `pxDiscard {p, uids: string[]}` and the auto `aiPolitix {p}`. Each case opens with
      `d.challenge === "politix"`, `d.seats[p] === "human"` (or `"ai"` for `aiPolitix`), the right
      phase, and `p` being the seat to move; `pxPlay` re-runs `pxLegalPlay` and refuses with a toast
      key per refusal; `pxDiscard` must leave exactly `PX_HAND_MAX` cards. Identity is by `uid`.
      `SCOPE` classifies the four as `"seat"` and `aiPolitix` as `"auto"` — the only change to
      `protocol.ts`. Every refusal is reached directly in `reducer.test.ts`.
- [ ] **The measured claims, headless.** A test (or a throwaway script whose figures land in the
      README) plays **at least 200 seeded all-AI games** (the human seat decided by `pxMove`) and
      asserts every game ends within `PX_TURN_CAP` (600 turns) with the table and voter deck empty,
      `sum(collected) === 42` for every game, and party 0's share of decided games is within
      **35–65 %**. README reports median and p90 total turns, the draw share and that win share.
      If the median falls outside **30–150 turns**, the action-deck counts are re-tuned and the
      tuning recorded, never the sheet's own constants.
- [ ] **Felt, hand, rail, result screen and board.** `Table.tsx` returns `<PolitixTable />` beside
      the RPS branch, ahead of every hook: the face-up voter cards grouped by group with their four
      needs, the active event, each seat's politician (name, skills), the specials and burnout in
      front of each seat, each seat's hand **count** only, both parties' per-group counts, draw /
      discard / voter-deck counts, whose turn it is, and the last take (`last` in `PolitixState`,
      rendered in the viewer's language — not a toast). `Hand.tsx` gains a `g.challenge === "politix"`
      branch drawing the viewing seat's action cards as selectable `PolitixCard`s plus `<Hint />`.
      The felt's action bar carries Draw, Play (disabled while `pxLegalPlay` refuses, showing
      power vs need), Rest (only under burnout) and, in `pxdiscard`, Discard (enabled at exactly
      ten kept). Graphics are original inline SVG shapes (`PolitixIcon`), no publisher art, no new
      text glyph. `Rail.tsx` draws `PolitixPlate` in place of `ChallengePlate` on a two-page strip.
      `Screen` gains `{ kind: "politixover"; winner: 0 | 1 | "draw"; counts: [number[], number[]]; turns: [number, number] }`,
      drawn by `screens/PolitixOver.tsx` (won/lost/drawn from `teamOf(useViewSeat())`, Play again,
      Back to your run through `MoveButton`, and its board). `scores.ts` gains
      `POLITIX_SCORES_VERSION = 1`, `PolitixRow {seed, result, turns, at}` (won, drawn, lost; then
      fewest turns; then earliest), `politixRowFor`, `addPolitixScore`, `parsePolitixScores`;
      `storage.ts` gains `readPolitixScores` / `writePolitixScores` on **`tupatro-politix-v1`**;
      `GameContext.tsx` files it on `politixover` and writes no snapshot. `SinglePlayer.tsx`'s
      `PositionLine` / `BestLine` gain a politix branch. The Play button and the hand are
      reachable at **1280×500** and **390×844** (checked in the browser, recorded in the PR).
- [ ] **Text and docs.** Every new key is in `fi.ts` and `en.ts` with matching placeholders; all
      card, politician, event and special names are this project's own wording (none copies the
      sheet's card text, none names a real person); numbers through `fmt()`. `Rules.tsx` gains a
      `rules.politixTitle` / `rules.politix` section that states the rules, says which data are this
      game's own, and credits the original design (Touko Tahkokallio, Onni Games 2009). README gains
      "The challenges: Politix" and a "### Politix" balance subsection; `CLAUDE.md` names the mode,
      `politix.ts`, the new board key and the ninth board-reading component. `render.test.tsx`
      sweeps both phases and `politixover` in both locales.

## Assumptions

Nobody answered a question. Each line below was a choice.

- **Four seats, two parties of two, partners across the table (`teamOf`).** The sheet allows two or
  three parties of equal size and seats partners **side by side**. Tupatro's seat model is fixed at
  four with partners across, so turn order alternates party A, B, A, B rather than the sheet's
  A, A, B, B. This is a **deviation from the sheet**, chosen so `teamOf`, `ownerSeat`, the result
  screen and every team-indexed reader work unchanged. Three parties and the five-player rule are
  out of scope.
- **Single player only, three AI seats.** The player's partner is an AI. Multiplayer would require
  `LOBBY_MODES` and a `NET_VERSION` bump, and a bump changes every existing mode's room ids and
  invitations — forbidden by "do not change the old modes". So no lobby entry and no hashing.
- **An AI is built**, `pxMove(g, p)`, deterministic and drawing no randomness: take the play that
  wins the most voter cards (ties: the group its party holds fewest of, then fewest cards spent,
  then table order), spending the fewest cards that reach that count, tactic cards before coffees;
  otherwise play burnout on an eligible opponent, a +1 modifier on itself or partner for a group on
  the table, a −1 on an opponent; rest under burnout when its hand holds ≤ 3 cards; otherwise draw.
  Over the hand limit it discards the cards contributing least to its best reachable play. It is a
  heuristic, not optimal, and the measurement measures it.
- **The card data are invented, because the sheet does not contain them.** Deck counts (60 action
  cards: 9 per tactic, 6 coffees, 12 group modifiers, 3 burnouts, 3 yesterday's news), the eight
  politicians and their skills, each group's needs (permutations of 2–5), the effects of three of
  the four events, and the two parties' symbol bonuses are this game's own, constrained as the
  criteria say and measured. Only the following come from the sheet: 3 drawn / 10 held / 4 to
  start / 8 on the table, the take rule, "+1 per extra card of the same group", lama (+1 growl),
  blondes 3 charm, youth 3 growl, skill values like "+2", and modifiers like "+1 / −1 toward a
  group".
- **7 cards per voter group (42) is inferred, not stated**: the sheet's page-6 example has the two
  parties' counts summing to exactly 7 in all six groups.
- **The six voter groups, four tactics, the coffee wildcard, burnout, yesterday's news and the four
  events keep the sheet's concepts** because they are the rule's structure, but every catalogue
  string is written fresh. Politicians, special-card names and flavour are original; no real
  politician is named or drawn (the sheet's examples are caricatures of real people — not used,
  the same line `CLAUDE.md` draws for photographs). The mode is called **Politix** because the user
  asked for that name; the rules panel credits the original designer.
- **Party symbol bonus**: the sheet says a party symbol card can give bonuses but not which. Each of
  the two parties gets one permanent, unremovable +1 toward one voter group — party 0 white-collar,
  party 1 workers — symmetric by construction. Which party is "right" or "left" is presentation only.
- **Specials played in a turn resolve before the take**, in the order listed, so a +1 played on
  oneself counts at once. The sheet does not order them within a turn.
- **A politicking play that cannot take anything is refused**, rather than allowed to waste cards.
  The sheet does not forbid it; refusing keeps the UI's "Play" honest and the reducer authoritative.
- **The maximum affordable number of cards is taken automatically**; nobody would choose fewer.
- **A play turn must play at least one card**; an empty play is refused, so every turn is a draw, a
  rest or a real play.
- **Only the topmost event is active** (the sheet places a new event "on top of the previous").
  Before the first event appears none is active. Event cards never count toward the eight.
- **Scoring includes zero-count groups** in the ascending comparison. **Turns** count every turn a
  seat took — draw, play and rest. A tie on both is a drawn game.
- **Discarding down to ten is a visible step for the human** (`pxdiscard`), per `CLAUDE.md`'s "an
  automatic choice is not a decision"; the AI discards inside its own action.
- **When both draw and discard piles are empty, a draw takes what there is** (possibly nothing).
- **Burnout's "draws 2 instead of 3"** applies only to draw turns; the rest of play is unchanged.
- **Not resumable.** No screen is reached before the result, so no snapshot is written and
  `rehydrate` rejects any payload naming the mode, exactly the RPS outcome. A reload mid-game loses
  it; Continue on the row only appears while this window is in the game (`closeMenu`).
- **Partner hands are hidden from the player** (the sheet forbids showing them); collected voter
  cards are public.

## Touch points

- `src/game/types.ts` — `ChallengeId` + `"politix"`; `Phase` + `"pxturn"` `"pxdiscard"`;
  `PxTactic` `PxGroup` `PxCard` `PolitixState` (hands, politicians, draw/discard piles, voter deck,
  table, event, specials and burnout per seat, collected per party, turns per party, turn seat,
  turn number, last take); `GameState.politix`; `Screen` + `politixover`.
- `src/game/politix.ts` (new) and `src/game/politix.test.ts` (new) — the rule, scoring, AI.
- `src/game/content.ts` — `CHALLENGES` row; `PX_POLITICIANS` `PX_GROUP_NEED` `PX_EVENTS`
  `PX_ACTION_DECK` `PX_PARTY_BONUS`.
- `src/game/constants.ts` — `PX_DRAW` `PX_BURNOUT_DRAW` `PX_HAND_MAX` `PX_START_HAND` `PX_TABLE`
  `PX_GROUP_CARDS` `PX_TURN_CAP`, each citing the sheet or the measurement.
- `src/game/state.ts` — `createRun` initialises `politix: null`.
- `src/game/actions.ts` — the five actions.
- `src/game/reducer.ts` — `startDeal`'s politix arm; the five cases; opening `politixover`.
- `src/game/schedule.ts` — `nextTick` and `waitingSeat` arms.
- `src/game/race.ts` — `matchModeOf`'s `case "politix"` returning `null` (compile-forced).
- `src/game/save.ts` — `"politix"` in `Dropped`/`DROPPED_KEYS`; `rehydrate` refuses the id.
- `src/game/scores.ts`, `src/game/storage.ts` — board row and `tupatro-politix-v1`.
- `src/net/protocol.ts` — `SCOPE` entries only.
- `src/hooks/GameContext.tsx` — file the board row on `politixover`.
- `src/components/table/Table.tsx`, `src/components/table/PolitixTable.tsx` (new),
  `src/components/PolitixCard.tsx` / `PolitixIcon` (new).
- `src/components/hand/Hand.tsx`, `src/components/hand/Hint.tsx`, `src/components/panels/Panels.tsx`.
- `src/components/rail/Rail.tsx`, `src/components/rail/PolitixPlate.tsx` (new).
- `src/components/screens/Screens.tsx`, `src/components/screens/PolitixOver.tsx` (new),
  `src/components/screens/SinglePlayer.tsx` (`PositionLine`, `BestLine`),
  `src/components/screens/Rules.tsx`.
- `src/i18n/fi.ts`, `src/i18n/en.ts`.
- `src/index.css` — `.px*` rules only, after their own base rules (source-order note in CLAUDE.md).
- `src/test/render.test.tsx`, `src/test/invariants.test.ts`, `src/game/reducer.test.ts`,
  `src/game/save.test.ts`, `src/game/scores.test.ts`, `src/test/bot.ts` (a `playPolitix` driver).
- `README.md`, `CLAUDE.md`.

## Out of scope

- Any change to any existing mode, its saves, boards, goldens, AI or network behaviour.
- Multiplayer, the lobby, a shared table, `NET_VERSION`, `hashState` — Politix is solo only.
- Three parties, two-player or five-player games, and the sheet's five-player special rule.
- Saving or resuming a Politix game mid-game.
- Publisher art, card text, card names or real politicians' likenesses.
- An AI that reasons about opponents' hidden hands, or difficulty levels.
- Reusing Politiikka's `PARTIES`, government, Sofia or card faces.
- The superseded branch `spec/2026-11-03-add-politix-game-mode` and anything on it.

## Source

- **Politix rule sheet (Tahkokallio / Onni Games 2009), p. 1–2**: parties of players compete for
  voters; card types are politician, action (politicking: argumentation, evasion, charm, growling;
  plus the wild "pullakahvit"; and special cards) and voter-group cards; six voter groups and four
  events; each player starts with 4 action cards; 8 voter cards face up, events surfacing during
  setup shuffled back.
- **p. 3**: a turn is _either_ draw 3 action cards _or_ play cards; turns go clockwise; hand limit
  10 at turn end; a voter group card shows how many symbols of each tactic it takes.
- **p. 4**: choose one group and one tactic; play any number of that tactic's cards and coffees;
  power = cards played + the politician's skill + bonuses/minuses from specials, events and the
  party symbol; power ≥ need takes the card; each extra card of the same group costs +1 power;
  worked example (Ben: 1 card + skill 2 + lama +1 + special +1 = 5 vs need 3 → 3 cards); refill to
  8, an event goes on top of the previous one; play continues after the voter deck runs out until
  the table is empty, then the game ends at once; at least one politicking card is needed to take.
- **p. 5**: specials may be played even on a turn that takes nothing, onto any player, and lie
  beside that politician; yesterday's news removes one special (not a party symbol); burnout goes
  on an opposing-party player, makes their draw 2 instead of 3, can be shed by resting (losing the
  turn) or by yesterday's news, and cannot be doubled; played and removed cards go to discard.
- **p. 6**: an empty draw pile is rebuilt from the shuffled discard; partners may not show hands;
  scoring compares each party's weakest group, then second-weakest, and so on; full tie → fewer
  turns; worked example (right 6/5/4/2/2/1 vs left 6/5/5/3/2/1 → left wins on its third-weakest group, 3 workers against the right's 2).
- **Readings chosen where the sheet is silent or contradicts the seat model** are the Assumptions
  above; each also belongs in a code comment beside the rule in `politix.ts`.
