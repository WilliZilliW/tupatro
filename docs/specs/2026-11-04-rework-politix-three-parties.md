---
id: 2026-11-04-rework-politix-three-parties
title: Rework Politix into three parties of one, a 54-card action deck and the burnout / yesterday's news / scandal specials
kind: rule
status: proposed
source: >
  Politix rule sheet, Touko Tahkokallio / Onni Games 2009, 6 pages
  (<https://lautapeliopas.fi/wp-content/uploads/2009/06/Politix_ohjeet.pdf>, read from the local
  copy of that PDF), authoritative. <https://www.lautapeliopas.fi/peliarvostelut/politix/> confirms
  42 voter cards (6 groups x 7), 2-6 players and the weakest-group-wins rule; a reader comment there
  gives 9 politicians, 3 each for SDP, Keskusta and Kokoomus. The deck split (54 = 36 + 6 + 12), the
  three special kinds and their counts, the party-symbol groups and the event directions come from
  the user's own notes, which cite no source. Neither tuppi source (the Oulunsalo senior tuppi club
  rule sheet, Antti Auer, 9 September 2022, and <https://korttipeliopas.fi/tuppi>) knows this game.
---

# Rework Politix into three parties of one, a 54-card action deck and the burnout / yesterday's news / scandal specials

## What

Politix (id `"politix"`, delivered on `main` by `2026-11-03-add-politix-card-game-mode`) is played
by **three politicians in three parties** — Right, Centre and Left, each with its own party symbol
(SUV, tractor, bus) that gives a fixed bonus toward its core voter group — instead of four seats in
two parties of two. The action deck becomes the user's **54 cards** (9 of each of the four
politicking tactics, 6 wild Pullakahvit, 4 Burnout, 4 Eilisen uutiset, 4 Skandaali); the per-group
+1/−1 modifier cards are gone, and the four events become the sheet's own four (beauty pageant, age
of reason, recession, doping scandal). The winner is still the party whose weakest voter group is
strongest, now compared across three parties.

**Nothing outside Politix moves.** The roguelike, Tuppi-Rummikub, the race, Traditional Tuppi,
Multiplayer Tupatro, both Nami variants, Rock-Paper-Scissors and Politiikka keep byte-identical
behaviour, saves, goldens, boards and network protocol. `teamOf` is not touched and is no longer
read by any Politix rule: the party of a seat becomes Politix's own data in `PolitixState`.

**This spec reverses parts of `2026-11-03-add-politix-card-game-mode` on purpose** — its two parties
of two, its 60-card deck, its group-modifier cards, its eight politicians, its permutation-of-2..5
need table, its two −1 events, its party-0 win-share band and its board version 1. Where the two
specs disagree **this one wins**, because the user asked for exactly these changes. Everything else
that spec delivered stands: single player only, not resumable, the two phases `pxturn` /
`pxdiscard`, the five actions and their `SCOPE`, the take rule, the hand limit and the board key.

## Acceptance criteria

- [ ] **Every other mode is byte-identical, and the diff proves it.**
      `git diff origin/main -- src/net/ src/game/save.ts src/game/race.ts src/game/actions.ts src/game/state.ts src/game/schedule.ts src/game/storage.ts src/game/seats.test.ts src/game/rps.ts src/game/politics.ts src/game/puolue.ts src/game/nami.ts src/game/points.ts src/game/laydown.ts src/game/scoring.ts src/game/rules.ts src/game/ai.ts src/game/economy.ts src/game/shop.ts src/hooks/ src/components/screens/SinglePlayer.tsx`
      is empty. In `types.ts`, `content.ts`, `constants.ts`, `reducer.ts` and `scores.ts` the diff
      touches only the Politix blocks (`Px*` types, `PolitixState`, the `politixover` `Screen`
      member, `PX_*` tables and constants, the reducer's `==== politix ====` section and
      `startDeal`'s politix arm, the Politix board). `NET_VERSION`, `SCOPE`, `hashState`,
      `LOBBY_MODES`, `SAVE_VERSION` (3), the `CHALLENGES` row for `"politix"` and every storage key
      are unchanged; `teamOf` is unchanged and `grep -n "teamOf" src/game/politix.ts
src/components/table/PolitixTable.tsx src/components/hand/PolitixHand.tsx
src/components/rail/PolitixPlate.tsx src/components/screens/PolitixOver.tsx` finds nothing.
      `npm test` passes with no assertion edited outside the Politix tests (`politix.test.ts`, the
      `Politix` describe in `reducer.test.ts`, the Politix cases in `scores.test.ts`, and
      `render.test.tsx`'s `politixState` fixture and Politix cases).
- [ ] **Three parties as data, independent of `teamOf`.** `types.ts` gains
      `PxPartyId = "right" | "centre" | "left"`; `content.ts` gains `PX_PARTIES` (that order) and
      `PX_PARTY_SYMBOL: Record<PxPartyId, { symbol: "suv" | "tractor" | "bus"; group: PxGroup }>` =
      right → SUV → `whitecollar`, centre → tractor → `farmers`, left → bus → `workers`;
      `PX_PARTY_BONUS` is deleted, and the bonus magnitude is `PX_SYMBOL_BONUS = 1` in
      `constants.ts`. `PolitixState` gains `party: Four<PxPartyId | null>`; `politicians` becomes
      `Four<string | null>`; `collected` becomes `Record<PxPartyId, number[]>` (PX_GROUPS order) and
      `turns` `Record<PxPartyId, number>`. Power adds `PX_SYMBOL_BONUS` exactly when the group is the
      acting seat's party's symbol group, and a test asserts it for all three parties and its
      absence for every other group.
- [ ] **Three playing seats, one sitting out, all by lot.** `pxSetup` takes the owner seat: seats
      `owner`, `owner+1`, `owner+2` (mod 4) play and `owner+3` sits out with `party` null,
      `politician` null, an empty hand, no burnout and no scandals. The three parties are dealt to
      the three playing seats by the run's `Rng` (each exactly once), each playing seat's politician
      is drawn from **its own party's three**, the starting seat is drawn among the three, and every
      action card's `uid` comes from the mint. `pxNextSeat(px, p)` (exported from `politix.ts`) is
      the next clockwise seat whose `party` is not null; `pxEndTurn` uses it instead of `(turn+1)%4`.
      A test over 50 seeds (owner 0, and owner 2 for at least one seed) asserts each party appears
      exactly once, the sitting-out seat never holds `turn` across a whole `playPolitix` game, and
      `party[s]` equals the party of `politicians[s]`. Same seed and decisions → identical
      `PolitixState` and `rngState`.
- [ ] **Nine politicians, three per party.** `PX_POLITICIANS` has exactly 9 rows, each with a
      `party: PxPartyId`, 3 per party, original names only (no real person). Tested constraints:
      each politician's four skills lie in `0..2` and sum to exactly 3; no two politicians share a
      skill vector; within each party the three politicians' summed skills are ≥ 1 in every tactic.
- [ ] **The 54-card action deck, tested by count.** `PX_ACTION_DECK` builds exactly 54 cards: 9
      `tactic` cards of each of the four tactics (36), 6 `coffee` (Pullakahvit), 4 `burnout`, 4
      `news` (Eilisen uutiset) and 4 `scandal`. `PxCard["kind"]` is
      `"tactic" | "coffee" | "burnout" | "news" | "scandal"` — `"mod"` and the `delta` field are
      gone. The four scandals' groups are `PX_SCANDAL_GROUPS = ["hippies", "hippies", "blondes",
"youth"]`. The voter deck stays 42 group cards (7 per group) plus 4 events.
- [ ] **Voter-group needs and events obey stated constraints.** Each group has a _home_ tactic
      (`PX_GROUP_HOME`): blondes → charm, youth → growl, hippies → argue, whitecollar → argue,
      farmers → evade, workers → growl. Each group's four needs in `PX_GROUP_NEED` are a
      permutation of `[3, 4, 5, 6]` with the 3 on its home tactic, so the home tactic is its strict
      cheapest; blondes' charm need is 3 and youth's growl need is 3 (the sheet's two figures); every
      tactic is home to at least one group. `PxEventId` is
      `"pageant" | "reason" | "recession" | "doping"`, and `PX_EVENTS` moves exactly one tactic by
      **+1** each — pageant charm, reason argue, recession growl, doping evade — four distinct
      tactics. All asserted in `politix.test.ts`.
- [ ] **Special cards, each rule pinned and each refusal reached.** A special is aimed at a
      **playing** seat (never the sitting-out one). **Burnout**: only onto a seat of another party
      with no burnout (refusal `badBurnout`); that seat's draw turn draws `PX_BURNOUT_DRAW` (2)
      instead of `PX_DRAW` (3); resting discards it and ends the turn. **Skandaali**: only onto a
      seat of another party (new refusal `badScandal`, toast `toast.pxBadScandal`); any number may
      lie in front of one seat; each lowers that seat's power toward the card's group by
      `PX_SCANDAL_DELTA = -1` under **every** tactic and nothing else, permanently, until removed.
      **Eilisen uutiset**: removes exactly one burnout or scandal lying in front of any playing seat,
      own included; both cards go to the discard pile; a `remove` naming anything else — a card in a
      hand, a party symbol, nothing — is refused (`badNews`). A play of specials only takes nothing
      and draws nothing. `PxSpecial`'s shape is unchanged. `PolitixState.mods` is renamed
      `scandals: Four<PxCard[]>`. Every refusal is reached directly in `reducer.test.ts`.
- [ ] **Power and the sheet's examples.** Power = politicking cards played + the politician's
      skill in that tactic + the active event's change for that tactic + `PX_SCANDAL_DELTA` per
      scandal of that group in front of the seat + `PX_SYMBOL_BONUS` if the group is the party's
      symbol group. `politix.test.ts` pins: the sheet's p. 4 arithmetic `pxTakeCount(5, 3, 4) === 3`;
      the p. 4 example rebuilt without the +1 special this deck no longer contains (skill 2 growl,
      recession, one growl card, youth's growl need 3, four youth on the table → power 4, takes 2);
      and the p. 5 example as a scandal (a hippies scandal in front of a seat lowers its hippies
      power by exactly 1 under all four tactics and leaves every other group's power unchanged).
- [ ] **Scoring across three parties.** `pxWinner(collected: number[][], turns: number[]): number[]`
      returns the indices of every party tied for best: per-group counts sorted ascending and
      compared lexicographically, ties broken by fewer turns, a remaining tie returning all tied
      indices. Tests: the sheet's p. 6 example as two-party input → `[1]`; a three-party unique
      winner; a two-way vector tie decided by turns; a two-way full tie → two indices; a three-way
      full tie → three. The `politixover` screen becomes
      `{ kind: "politixover"; winners: PxPartyId[]; counts: Record<PxPartyId, number[]>; turns: Record<PxPartyId, number>; parties: Four<PxPartyId | null> }`.
      `PolitixOver.tsx` reads the viewer's party from `parties[useViewSeat()]`: **won** when
      `winners` is exactly that party, **drawn** when it is one of two or more, **lost** otherwise,
      and lists all three parties' counts and turns.
- [ ] **The board is re-versioned, not re-keyed.** `POLITIX_SCORES_VERSION` is `2`; the key stays
      `tupatro-politix-v1` and `PolitixRow` keeps `{seed, result, turns, at}`. `politixRowFor` reads
      the owner seat's party and that party's turns. `scores.test.ts` asserts a version-1 payload
      parses to `[]` and a three-party won / drawn / lost row each file correctly.
- [ ] **The AI, deterministic and drawing no randomness.** `pxMove` in order: the take that wins
      the most voter cards (ties as now: the group its party holds fewest of, then fewest cards
      spent, then table order); else Eilisen uutiset on its own burnout, then on its own scandal
      whose group is on the table; else rest under burnout with ≤ 3 cards; else burnout on an
      opponent without one; else a scandal on an opponent; else draw. "Opponent" = playing seat of
      another party, preferring the one whose party currently ranks higher under `pxWinner`, then
      clockwise from the mover. **Measured, headless:** 200 seeded all-AI games (`playPolitix`,
      seeds `PXM0`…`PXM199`) all end within `PX_TURN_CAP` (600) with table and voter deck empty and
      42 voter cards collected in total; median total turns in **30–150**; each party's share of
      decided games in **20–47 %**. If the median or a share falls outside its band, only the
      non-home needs (the 4/5/6 entries) and `PX_SCANDAL_GROUPS` may be re-tuned, and the tuning is
      recorded in README.
- [ ] **Felt, hand, text, docs.** `PolitixTable` draws exactly three politician areas (party name,
      party symbol icon and its group, politician name and skills, burnout, scandals) and nothing
      for the sitting-out seat, plus all three parties' per-group counts. `PolitixHand`'s target
      picker offers burnout and scandal only the seats of other parties, and Eilisen uutiset a list
      of every burnout and scandal in front of any playing seat. `PolitixCard`/`PolitixIcon` gain
      original abstract inline-SVG icons for `scandal`, `suv`, `tractor` and `bus` and lose `mod`.
      `PolitixPlate` shows three parties. Every new or changed string is in `fi.ts` and `en.ts`
      (`px.party.*`, `px.symbol.*`, `px.pol.*` for nine, `px.event.*` for the four new ids,
      `px.scandal`, `toast.pxBadScandal`; `px.mod` / `px.mods` deleted) with matching placeholders,
      numbers through `fmt()`. `Rules.tsx`'s Politix section, README's "The challenges: Politix" and
      "### Politix" balance table, and `CLAUDE.md`'s Politix paragraph describe three parties, the
      54-card deck, the three specials, which numbers are the sheet's / the user's / this game's
      own, and the five-player rule as not supported. `render.test.tsx` sweeps both phases and
      `politixover` in both locales; the Play and Draw buttons and a target picker are reachable at
      **1280×500** and **390×844** (checked in the browser, recorded in the PR).

## Assumptions

Nobody answered a question. Each line below was a choice.

- **Supersedes parts of `2026-11-03-add-politix-card-game-mode`** (see What). That spec's file is
  not edited here (one file per run); its `status` should be read as superseded for the points
  listed. Its own README balance figures (median 67 turns, 50.8 % party-0 share) are replaced.
- **Three players, one per party, the fourth chair sits out.** The sheet allows two or three
  parties of equal size "if possible" and 2–6 players; three parties of one is a legal setup and
  the only three-party setup that fits Tupatro's four `Seat`s with equal parties. Four seats in
  three parties (2+1+1) was rejected as unequal with no compensation rule in the sheet. **The
  two-parties-of-two game is removed**, not kept as a variant — a variant would need a picker or a
  tenth id. The sitting-out seat is `owner+3` (the owner's right-hand chair); its `g.seats` entry
  stays `"ai"` and it never moves.
- **The five-player special rule is not supported.** It needs five seats (`Seat` is `0|1|2|3` and
  every mode reads it); its mechanism (the two-player party draws six hidden base-support voter
  cards, the smaller party starts) is not applied to any other configuration by analogy.
- **Parties, politicians and the starting seat are by lot** (the sheet: "arpomalla tai yhteisellä
  päätöksellä"); the player does not pick a party. No partners exist, so the sheet's "partners
  sit side by side / may not show hands" rules have nothing to apply to.
- **Parties are named by bloc — Right / Centre / Left (Oikeisto / Keskusta / Vasemmisto), as the
  sheet itself names them** — not as SDP / Keskusta / Kokoomus from the user's note, so invented
  politicians are never attached to a real party's name. The three vehicles identify them.
- **Party symbols:** tractor → farmers is the user's firm note. SUV → **white-collar** (the note
  says "white-collar or blondes"). Bus → **workers** is not in the note at all. Magnitude **+1**
  (the note says only "a fixed bonus"). A symbol is not a card in `scandals`, so Eilisen uutiset
  can never name one — the user's and the sheet's rule, enforced by construction.
- **The deck contradicts the sheet, and the user's deck wins.** The sheet's own examples include a
  _positive_ group special (+1 youth, p. 4) and say specials may be positive or negative (p. 5).
  The user's firm split leaves 12 specials = 4 burnout + 4 news + 4 scandal, so **no positive
  special exists**; the p. 4 example is rebuilt without it. The note's "remove … a card benefiting
  an opponent" therefore has nothing to remove besides burnout and scandal.
- **Skandaali targets are invented**: `["hippies", "hippies", "blondes", "youth"]` — the user's
  own example (hippies) doubled, plus the two other groups that are no party's symbol group, so no
  scandal cancels a party symbol. **Restricted to opposing parties** (the note: "an opponent's
  politician"), **stackable** (only burnout is "never doubled" in the sheet), **−1 under every
  tactic** toward that group (the note's "vaalitaktiikka" read as the courting of that group).
- **Need values are invented except two.** "Home" tactic = a group's strict cheapest. Blondes 3
  charm and youth 3 growl are the sheet's; hippies → argue is the note's ("most sensitive to
  argumentation"). Whitecollar → argue, farmers → evade, workers → growl, every home need 3 and
  the other three a permutation of 4/5/6 are this game's own. The sheet's "vastaava luku" (p. 4)
  is read as a number per tactic on every group card, so every group stays courtable by all four.
- **Event magnitudes are invented except one**: recession +1 growl is the sheet's and the note's;
  pageant +1 charm, reason +1 argue and doping +1 **evade** (the note says "kiertely/murahtelu";
  evade chosen so the four events cover four distinct tactics) are this game's own. Only the
  topmost event is active, as before.
- **Card and event names follow the game's components** (Pullakahvit, Burnout, Eilisen uutiset,
  Skandaali, Missikisat, Järjen aika, Lama, Doping-skandaali, with English equivalents) — names,
  not copied text; descriptions and the nine politicians' names are written fresh, and no real
  person is named or drawn.
- **Board version bumped, key kept**: rows filed under the two-party rules are discarded by the
  version gate rather than re-sorted against three-party games (the RPS precedent).
- **Measurement bands are new**: three parties make a fair share 33 %, so 20–47 % replaces
  2026-11-03's 35–65 % party-0 band; 30–150 total turns is kept.

## Touch points

- `src/game/types.ts` — `PxPartyId`; `PxEventId` ids; `PxCard.kind` (+`scandal`, −`mod`, −`delta`);
  `PolitixState` (`party`, `politicians`, `scandals`, `collected`/`turns` as party records);
  `politixover` `Screen` member.
- `src/game/content.ts` — Politix block: `PX_PARTIES`, `PX_PARTY_SYMBOL`, `PX_POLITICIANS` (9, with
  `party`), `PX_GROUP_HOME`, `PX_GROUP_NEED`, `PX_EVENTS`, `PX_SCANDAL_GROUPS`, `PX_ACTION_DECK`
  (54); delete `PX_PARTY_BONUS`.
- `src/game/constants.ts` — `PX_SYMBOL_BONUS`, `PX_SCANDAL_DELTA`, each with its source comment.
- `src/game/politix.ts` — header comment's readings; `pxSetup(rng, mint, owner)`, `powerOf`,
  `pxResolve` (scandal, news over scandals/burnouts, opposing-party test via `party`),
  `pxNextSeat`, `pxWinner` (N parties), `bestTake`, `pxAiDiscard`, `pxMove`.
- `src/game/politix.test.ts` — every constraint and example above.
- `src/game/reducer.ts` — `startDeal`'s politix arm (pass `ownerSeat(d)`), `PX_TOAST`,
  `pxEndTurn`, `pxDoPlay`, `pxDoRest`.
- `src/game/reducer.test.ts` — the `Politix` describe.
- `src/game/scores.ts`, `src/game/scores.test.ts` — `POLITIX_SCORES_VERSION` 2, `politixRowFor`.
- `src/components/table/PolitixTable.tsx`, `src/components/hand/PolitixHand.tsx`,
  `src/components/PolitixCard.tsx`, `src/components/rail/PolitixPlate.tsx`,
  `src/components/screens/PolitixOver.tsx`, `src/components/screens/Rules.tsx`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `px.*`, `toast.pxBadScandal`, `rules.politix*`.
- `src/index.css` — `.px*` rules only.
- `src/test/render.test.tsx` — `politixState` fixture and Politix cases; `src/test/bot.ts`
  `playPolitix` only if its loop needs it.
- `README.md`, `CLAUDE.md` — the Politix sections and the balance table.

## Out of scope

- Any change to another mode, `teamOf`, `Seat`, `g.seats`' shape, saves, boards other than
  Politix's, goldens or the network (`NET_VERSION`, `SCOPE`, `hashState`, `LOBBY_MODES`).
- Multiplayer Politix, a lobby entry, a shared table — still single player only.
- The five-player special rule, two-player games, six players, or keeping the two-parties-of-two
  configuration as a variant.
- A party or politician picker; the player gets both by lot.
- Positive group specials (the sheet's "anarkistiset aatokset" / "lisäydinvoima" kind) — the
  user's 54-card split has no room for them.
- Saving or resuming a Politix game mid-game.
- Publisher art, card text, real parties' logos or real politicians' names or likenesses.
- An AI that reasons about hidden hands, or difficulty levels.
- Editing `docs/specs/2026-11-03-add-politix-card-game-mode.md` itself.

## Source

- **Politix rule sheet (Tahkokallio / Onni Games 2009), p. 1**: players split into **two or three
  parties** — right, centre and left; each party has a party symbol card: the right's SUV
  (katumaasturi), the left's bus, the centre's tractor. Pullakahvit stands in for any of the four
  tactics. Six voter groups; four events — missikisat, järjen aika, lama, doping-skandaali.
- **p. 2**: each party should have equally many players if possible; with five players use the
  special rule; partners sit side by side; parties place their symbol card near their politicians;
  each player takes 4 action cards; 8 voter cards face up, events met during setup shuffled back;
  the starting player is drawn by lot. Parties and characters are chosen "by lot or by agreement".
- **p. 3**: a turn is draw 3 _or_ play; clockwise; hand limit 10; blondes' cards show three charm
  symbols, so courting blondes needs 3 charm power.
- **p. 4**: power = cards played + the politician's skill + bonuses and minuses from specials,
  events and the party symbol card, compared with the card's "corresponding number" for that
  tactic; each extra card of the same group costs one more power; the worked example (Ben: skill
  +2 growl, lama +1, a +1-youth special, one growl card → 5 against youth's 3 → three cards).
- **p. 5**: specials lie beside a politician and most name a group and a + or −; worked example:
  a special gives Sauli −1 toward hippies (the precedent for Skandaali). Eilisen uutiset removes
  one special from any player and **cannot remove a party symbol card**. Burnout goes onto a player
  of another party, draws 2 instead of 3, is shed by resting (losing the turn) or by Eilisen
  uutiset, and cannot be doubled. A turn that plays only specials draws nothing.
- **p. 6**: an empty draw pile is rebuilt from the shuffled discard; weakest group first, then the
  next, then fewer turns; the right 6/5/4/2/2/1 vs left 6/5/5/3/2/1 example. **Five-player special
  rule**: two parties of two and three; the two-player party draws six hidden voter cards as base
  support; the smaller party's first player starts — not supported here (see Assumptions).
- **lautapeliopas.fi review**: 2–6 players; 42 voter cards, 6 groups x 7; parties right, centre and
  social democrats; a reader comment: 9 politicians, 3 each for SDP, Keskusta and Kokoomus.
- **The user's notes (unsourced)**: the 54-card split and the counts of the three specials; burnout
  "next to an opponent's politician"; Eilisen uutiset cannot remove bus, tractor or SUV; Skandaali
  "−1 permanently toward one group, in front of an opponent's politician, e.g. hippies"; tractor →
  farmers, SUV → white-collar or blondes; hippies most sensitive to argumentation; lama +1 growl,
  missikisat boosts charm, järjen aika argumentation, doping-skandaali evade or growl. Hedged items
  are under Assumptions; each chosen reading also belongs in a comment in `politix.ts` or
  `content.ts` beside the rule or table it shapes.
