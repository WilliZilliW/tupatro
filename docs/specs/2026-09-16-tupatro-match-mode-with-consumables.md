---
id: 2026-09-16-tupatro-match-mode-with-consumables
title: Add Tupatro, a fourth mode — Traditional Tuppi's deal and point table, with temput in hand
kind: rule
status: proposed
source: <https://korttipeliopas.fi/tuppi> — the point table this mode reuses unchanged ("Kuudella kasalla joukkue saa neljä pistettä ja jokainen kasa vähemmän lisää pisteitä neljällä"; "Ramissa voittoon tarvitaan seitsemän kasaa… jokainen ylimääräinen kasa on neljän pisteen arvoinen"; "Ryöstetty rami on arvoltaan kaksinkertainen"; "Jos soolaaja selviää tikeittä, pari saa 24 pistettä. Jos soolaaja ottaa yhdenkin tikin, ramaajat saavat 24 pistettä"; "Peli päättyy, kun toinen joukkueista pääsee 52 pisteeseen."). Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) for the play itself, which this mode does not change. **Neither source knows of a one-shot item a player spends mid-deal** — the temput are Balatro's shell, not tuppi's, and `content.ts` already says so in the `temppukielto` comment. The contradiction that creates, and the chosen reading of it, is written out under Source below.
---

# Add Tupatro, a fourth mode — Traditional Tuppi's deal and point table, with temput in hand

## What

The lobby starts two modes today, the **Tuppikilpa / Tuppi Race** (chips × mult to 12,000) and
**Perinteinen tuppi / Traditional Tuppi** (tuppi's own point table to 52). This adds a third one it
can start, **Tupatro**: a Traditional Tuppi match in every respect — the same thirteen tricks, the
same declaration, sooli and ryöstö, the same point table, the same 52, the same lost-lead reset —
with one thing added, the roguelike's **temput** (consumables). Each seat holds up to two, draws one
at the start of every deal, and spends them during play exactly as the roguelike's player does.

Nothing else of the roguelike shell comes with them: no money, no shop, no jokers, no vouchers, no
tuppipakka, no blinds and no bosses. There is nothing to buy a temppu with, so the deal hands them
out. The Race, Traditional Tuppi, Tuppi-Rummikub and the main roguelike run are all unchanged in
what they score; what does change for the main run is that a spent temppu finally acts for the seat
that spent it rather than for the run owner, because a mode with four people spending them cannot
keep that shortcut.

## Prior specs and documents

Several of these carry `status: proposed` in their front matter although they shipped; `CLAUDE.md`
is the record of what is actually built, and it is what the readings below are taken from.

- **Extends `2026-09-08-traditional-tuppi-multiplayer-mode`, and partially fulfils one line of its
  Out of scope — but not the way that line reads.** That spec parked "an economy in the traditional
  mode: money, a shop, jokers, vouchers, **consumables**, a tuppipakka, a swap phase or a cash-out
  formula". This spec does **not** put temput into Traditional Tuppi: that mode keeps its empty
  boxes and every figure it has. The temput land in a fourth id beside it. The rest of that parked
  line — money, shop, jokers, vouchers, tuppipakka, swap phase, cash-out — stays parked.
- **Extends `2026-09-07-race-to-target-mode`.** The race's 12,000, its arithmetic, its board key
  and its rules text are untouched, and a criterion pins that. The new mode reuses `raceDeal`,
  `raceBase`, `raceScores`, `target`, the `raceover` screen, `matchOver`, `raceWinner` and
  `MatchPlate` exactly as the traditional mode does, so `GameState` gains no match field.
- **Inherits `2026-09-09-traditional-tuppi-score-reset` (delivered) whole.** A Tupatro deal that
  knocks a leading pair down resets both totals to 0–0 and awards nobody, the same branch, the same
  `MatchDealEnd` explanation.
- **Inherits `2026-09-09-both-defenders-sooli` (delivered) and
  `2026-09-16-ai-takes-sooli-when-sensible` (delivered) for free.** `sooliCandidates` is mode-blind
  now, so the new id needs no clause there. The canonical UID-sorted return pool in `sooliGive` is
  gated on the two match ids by name and **does** need the third — a missed arm there is a
  peer-by-peer divergence, not a cosmetic one.
- **Extends `2026-09-08-webrtc-transport` and `2026-09-08-shared-table-view-multiplayer`.**
  `useConsumable` is already `SCOPE`'s `"seat"`, and `ConsumablesBox` already draws its rows through
  `MoveButton`, so the read-only table needs no new rule — it needs the rail to actually draw the
  box in this mode, and the sweep to click it. `NET_VERSION` does move, and `hashState` gains one
  field; both are criteria.
- **Extends `2026-09-14-per-challenge-continue`.** A Tupatro match writes and clears its own
  `tupatro-run-tupatro-v1` slot through the existing `challengeRunKey(id)` with no new code, and
  the single-player screen gets its Continue row from `CHALLENGES` the same way.
- **Overlaps `2026-09-14-single-player-separate-from-multiplayer` and
  `2026-09-15-lobby-setup-steps-host-join`.** The mode picker stays exactly where it is, on the
  host's own setup page, and gains a third button. No other lobby page changes.
- **Contradicts nothing.** No delivered decision is reversed. The one delivered behaviour this
  changes outside the new mode is `useConsumable`'s and `resolveTrick`'s use of `ownerSeat`, which
  no spec ever named as a decision — it is the single-human shortcut the per-seat economy
  (`2026-09-07-per-seat-economy`) removed everywhere else and left here.
- **Nothing here is already delivered.** `src/game/` today has no `"tupatro"` id, no consumable is
  ever dealt outside a shop purchase, and `Rail.tsx` draws no `ConsumablesBox` in any challenge.

## The supply, and why the deal hands them out

There is no money in a match, so the roguelike's answer (buy them in the shop) does not exist. The
cheapest supply that needs no economy at all is a draw:

| When                            | Who                           | What                                                              |
| ------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `startDeal`, every Tupatro deal | all four seats, in order      | one `pick(rng, CONSUMABLES)` each — four draws, always            |
| the draw is **kept**            | a `"human"` seat with room    | appended to `econOf(d, p).consumables`, capped at `consSlots` (2) |
| the draw is **discarded**       | an `"ai"` seat, or a full box | nothing; the randomness is consumed regardless                    |

Four draws whatever the state holds is deliberate: a Tupatro deal then costs a fixed amount of
randomness, so what a seat is holding can never change what the **next** deal deals. A box that is
already full wastes its draw, which is the only pressure to spend that a free supply can have.

## Acceptance criteria

- [ ] **The id is data, and every ternary that maps a mode back to a key is widened.** `MatchId` is
      `"race" | "tuppi" | "tupatro"` in `src/game/types.ts`; `CHALLENGES` in `content.ts` carries a
      fourth row `{id:"tupatro", key:"challenge.tupatro", g:"♣", deals:0, target:TUPPI_TARGET}`;
      `MATCH_KEY` in `storage.ts` gains `tupatro: "tupatro-tupatro-v1"`; `LOBBY_MODES` in
      `Lobby.tsx` is `["race", "tuppi", "tupatro"]`. The three `=== "tuppi" ? "tuppi" : "race"`
      ternaries — `MatchPlate.tsx`, `RaceOver.tsx` and `GameContext.tsx`'s board write — resolve
      `"tupatro"` to itself, and a test asserts a finished Tupatro match files its row on
      `tupatro-tupatro-v1` and on neither other match board.
- [ ] **A Tupatro deal is a Traditional Tuppi deal, banked by `dealPoints`.** Every reducer site
      that spells `"tuppi"` spells `"tupatro"` beside it: `startDeal`'s match branch and its
      declaration route, `sooliGive`'s UID-sorted return pool, `resolveTrick`'s
      score-nothing branch, `endHand`'s `dealPoints` call **and its 0–0 reset clause**, and
      `showHandResult`. No `d.challenge` reaches a `)`, `?` or `&&` as a truth value —
      `invariants.test.ts` is unchanged and still passes. A `reducer.test.ts` case plays a whole
      Tupatro deal and asserts `raceBase` is `[0, 0]`, `pop` is null, and `raceScores` moved by
      exactly `dealPoints(g)`; a second case asserts the lost-lead reset fires in this mode too.
- [ ] **The deal hands out the temput, and only this mode's does.** `startDeal` draws exactly four
      `pick(rng, CONSUMABLES)` in seat order for `"tupatro"` and keeps each only for a `"human"`
      seat holding fewer than its `consSlots`; `TUPATRO_DRAW = 1` lives in `constants.ts` with the
      reason in its comment. Tests: a Tupatro match's first deal leaves every human seat holding
      one temppu and every AI seat holding none; a seat that spends nothing is capped at two; and
      the pinned goldens in `seats.test.ts` and every race/traditional/rummikub figure are
      **unmoved**, because no other mode draws.
- [ ] **A spent temppu acts for the seat that spent it, in every mode.** `useConsumable` stops
      calling `ownerSeat`: `kannanvaihto` flipping to rami sets `ramSeat`/`ramTeam` from `p`,
      `vaihtokauppa` trades `p`'s worst card for `partnerOf(p)`'s best and re-sorts both, and the
      theft is resolved for `p`. `reducer.test.ts` drives each of the five from **seat 2** in a
      Tupatro match and asserts the effect landed on seat 2's side; the main run's single-human
      behaviour is unchanged, which the existing cases hold.
- [ ] **The peek and the theft carry a seat in the state, and no other window sees either.**
      `reveal: boolean` becomes `revealTo: Seat | null` and `steal: boolean` becomes
      `stealFor: Seat | null`; `startDeal` clears both to null; `Seats.tsx` turns the other hands
      face up only when `!spectating && g.revealTo === you`. `resolveTrick` picks the stolen
      winner by a table written into a comment: **rami** → the spender's own side, **nolo** → the
      other side, **sooli** → the soloist when the spender is a defender and any other seat when
      the spender is the soloist. Four reducer cases, one per row, and a render case showing the
      peek is invisible on a second seat's window and on a shared table.
- [ ] **A temppu's toast is addressed to the seat that spent it.** `Toast` gains `p?: Seat`, the
      five `useConsumable` toasts carry it, and `Toasts.tsx` draws nothing when `toast.p` is set and
      is not the viewing seat, or when the window is spectating. This is a rule, not tidiness:
      broadcasting `toast.theftArmed` tells the opponents the next trick is stolen. A render case
      asserts the theft toast appears on the spender's window and on no other.
- [ ] **The rail draws the box in this mode, and in no other challenge.** `Rail.tsx`'s challenge
      page list is three pages for `"tupatro"` — the match plate, a `rp-kit` page holding
      `<ConsumablesBox />` alone, then the game page — and stays two for every other challenge.
      Measured in Chrome emulation at **390×844** and **1280×500**: the strip's `scrollWidth` is
      exactly three times its `clientWidth`, each page snaps flush, and every trick button is
      hit-testable with no page scroll.
- [ ] **A shared table can click none of it.** `render.test.tsx`'s table sweep covers a Tupatro rail
      with a full consumable box and asserts no click dispatches anything, with the same
      chair-holding vacuity guard the existing wallet sweep uses.
- [ ] **The transport refuses an older peer and hashes the boxes.** `NET_VERSION` goes to **9**,
      with the reason in its comment: `parseMsg` does not validate challenge ids, so a v8 peer given
      a numbered `startChallenge {id:"tupatro"}` would run **main-game** rules against it. `hashState`'s
      `purses` line gains each wallet's consumable ids, so a box that diverges raises the banner
      instead of hiding behind `rngState`. `SCOPE`, `guestMay`, `parseMsg` and the `NetMsg` union
      gain no member, and `protocol.test.ts` asserts the `local`-exception list is still length two.
- [ ] **`SAVE_VERSION` stays 3, and the argument is written down.** `revealTo` and `stealFor` are
      added fields that are null at every boundary the game writes a snapshot at — `startDeal`
      clears them and no screen opens mid-trick — so a v3 payload's stale `reveal` / `steal`
      booleans carry nothing that a resumed run needs; `save.ts`'s header comment says so as the
      sixth non-bump. `rehydrate` accepts `"tupatro"` through its existing `CHALLENGES` check, and a
      `save.test.ts` case round-trips a Tupatro state holding two temput per human seat and plays on
      identically.
- [ ] **The pace is measured headlessly, and 52 does not move.** `Policy` gains
      `useTrick(g, p): number | null`; `basicPolicy` implements one stated rule (spend the first
      legal temppu in the box when the box is full, on its own turn in `play`); `playRace` offers
      the acting seat a `useConsumable` before each of its `play` moves. At least **200 seeded
      matches** at `humans: 4` are played for `"tupatro"` and the same 200 seeds for `"tuppi"` as
      the baseline; every match finishes; median, mean, maximum and 10th–90th deal counts, plus the
      share of deals in which a temppu was spent, go into `README.md`'s Balance section beside
      Traditional Tuppi's. The target stays `TUPPI_TARGET`, whatever the pace says.
- [ ] **Text, in both catalogues and with the sources named.** `challenge.tupatro.n` (`"Tupatro"` in
      both) and `.t`, and a `rules.tupatroTitle` / `rules.tupatro` section in `Rules.tsx` that
      states the mode is Traditional Tuppi plus temput, lists the five and says plainly that **no
      tuppi source knows them** — they are this game's own. Placeholder sets match across locales,
      the i18n test picks up the new `CHALLENGES` row on its own, and `render.test.tsx` sweeps the
      Tupatro rail, table + hand, deal end and result screen in both languages.
- [ ] **Docs.** `README.md` gains a "The challenges: Tupatro" section and the measured figures;
      `CLAUDE.md`'s challenge section names the fourth id, the four-draw supply and the two renamed
      state fields; `docs/multiplayer.md` lists the mode and repeats that the rest of the roguelike
      economy stays unbuilt.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Tupatro" is read as a fourth `ChallengeId` inside `MatchId`: Traditional Tuppi plus temput, and
  nothing else different.** Same point table, same 52, same lost-lead reset, same 24 held / 24 to
  the declarers on a busted sooli. It is not a rename of an existing mode and not a flag on the
  traditional one, because a flag would have no name, no description, no board and no rules section.
- **"Only temput" is read as: consumables and nothing else of the shell.** No money, shop, jokers,
  vouchers, tuppipakka, swap phase, blinds or bosses. `temppukielto` is a boss, so the ban that
  `ConsumablesBox` draws can never fire in this mode; the code stays, unreachable, rather than
  being branched away.
- **The supply rule is invented here, because nothing in the requirement or any source says where a
  free temppu comes from.** One draw per seat per deal, capped at the existing `consSlots` of 2,
  four draws consumed whatever the boxes hold. A reviewer who wanted "two at match start and no
  more", or "one per deal won", is looking at the wrong game: this one is cheap, steady and
  measurable.
- **Only `"human"` seats keep a draw, and no AI ever spends a temppu.** `useConsumable`'s existing
  guard already refuses an AI seat, and teaching `chooseAI` to spend would need a new `auto` action,
  a `nextTick` arm, a `SCOPE` entry and a heuristic — a spec of its own. The consequence is blunt:
  **a Tupatro match against bots is lopsided in the humans' favour**, by construction. The
  measurement reports how lopsided; the mode is meant for four people.
- **The mode appears on the single-player screen too, although the requirement said multiplayer.**
  `CHALLENGES` is what both screens read, and every match mode is on both today. Removing it from
  one would be a filter written specially; the solo match is also where the headless measurement
  and the manual playtest live.
- **The seat-honesty fixes land in the main roguelike as well**, because there is one
  `useConsumable`. Rami and nolo behaviour there is unchanged (the one human _is_ the owner). The
  **sooli theft does change in the main game**: today it picks the first card in the trick that is
  not the owner's, which may be the soloist's partner and so steal nothing that matters; it will
  name the soloist. That is a deliberate correction, and it moves no pinned literal because
  `basicPolicy` never buys a temppu in the golden runs.
- **`vaihtokauppa` takes a human partner's best card without asking them.** In a four-human match
  that is one player reaching into another's hand. It is the trick's existing rule and it is not
  softened here; the partner sees the result in their own hand and, under the addressed-toast rule,
  is **not** told which card went. A reviewer may well want a toast for the partner too.
- **`kannanvaihto` lets a defender flip the declaration and make themselves the declarer** in a mode
  otherwise played by tuppi's rules. That is what the trick does in the roguelike, kept as is.
  Tuppi has no such move, and the rules panel says so rather than implying the source allows it.
- **`NET_VERSION` 9 shuts v8 peers out of Race and Traditional matches too**, which they could
  otherwise still play together. Accepted: the alternative is a v8 peer silently running main-game
  rules on a `"tupatro"` id, and the hash changes anyway.
- **`SAVE_VERSION` is not bumped for the `revealTo` / `stealFor` rename**, on the argument in the
  criterion. If that argument is wrong — if any code path can write a snapshot mid-deal with a peek
  live — the right answer is the bump, not a companion field.
- **The row glyph is `♣`**, a suit the game already draws on every card, so no tofu canvas
  comparison is needed. The name is "Tupatro" in both locales, like "Tuppi-Rummikub".
- **Temput stay spendable only in the `play` phase**, the existing guard, unrevisited. A Tupatro
  temppu therefore cannot be spent during the declaration, the sooli exchange or between deals.

## Touch points

The files and functions this is expected to change. Named from the code as it stands.

- `src/game/types.ts` — `MatchId`; `Toast.p?: Seat`; `GameState.revealTo` / `stealFor` replacing
  `reveal` / `steal`; the match-mode comment block.
- `src/game/constants.ts` — `TUPATRO_DRAW`, with the supply argument in its comment.
- `src/game/content.ts` — the fourth `CHALLENGES` row.
- `src/game/state.ts` — the `createRun` literal's `revealTo:null, stealFor:null`.
- `src/game/reducer.ts` — `startDeal` (the match branch, and the four draws); `sooliGive`'s
  UID-sorted pool; `resolveTrick` (the theft's seat table, the score-nothing branch);
  `useConsumable` (every `ownerSeat` → `p`, the addressed toasts); `endHand`; `showHandResult`.
- `src/game/storage.ts` — `MATCH_KEY`.
- `src/game/save.ts` — no shape change; the header comment's sixth non-bump paragraph.
- `src/net/protocol.ts` — `NET_VERSION` to 9, `hashState`'s `purses`.
- `src/components/rail/Rail.tsx` — the three-page challenge strip for `"tupatro"`.
- `src/components/rail/MatchPlate.tsx` — the mode ternary and the deal-points row.
- `src/components/table/Seats.tsx` — `revealTo === you`.
- `src/components/Toasts.tsx` — the addressed-toast filter.
- `src/components/screens/DealEnd.tsx`, `RaceOver.tsx` — the `"tuppi"` arms gain `"tupatro"`.
- `src/components/screens/Lobby.tsx` — `LOBBY_MODES`.
- `src/components/screens/Rules.tsx` — the new mode section.
- `src/hooks/GameContext.tsx` — the board-key ternary.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `challenge.tupatro.*`, `rules.tupatro*`.
- `src/test/bot.ts` — `Policy.useTrick`, `basicPolicy`, `playRace`'s per-turn offer.
- `src/game/reducer.test.ts`, `src/game/save.test.ts`, `src/game/scores.test.ts`,
  `src/net/protocol.test.ts`, `src/test/render.test.tsx` — the cases above.
- `README.md`, `CLAUDE.md`, `docs/multiplayer.md`.

## Out of scope

- **Temput in Traditional Tuppi, the Race or Tuppi-Rummikub.** Those three keep empty boxes and
  every measured figure they have; a criterion pins their goldens unmoved.
- **The rest of the roguelike shell in a match** — money, the shop, jokers, vouchers, the
  tuppipakka, the swap phase, blinds, bosses, cash-out. Still `docs/multiplayer.md`'s stage 3b.
- **An AI that spends temput.** Needs a new `auto` action, a `nextTick` arm, a `SCOPE` entry and a
  heuristic; it is the obvious next spec and the honest fix for the lopsidedness named above.
- **New temput.** The table stays the five in `CONSUMABLES`; none is retuned or reworded.
- **Per-seat `consSlots` tuning, a slots upgrade, or a discard picker in this mode.** The cap is the
  existing 2 and a full box wastes its draw.
- **Any change to `tuppiInfo`, `tuppiMult`, `finalScore`, `scoreTrick`, `dealScores` or
  `dealPoints`.** No arithmetic moves; the new mode calls `dealPoints` unchanged.
- **A new phase, a new `Screen` kind, a second `setTimeout` call site, a new `Action` member or a
  new `NetMsg`.**
- **Late joining, reconnect, an AFK timer, and a networked match filing a board row** — all three
  are named Known gaps and none is touched.
- **The lobby's Start staying enabled mid-match**, the gap `2026-09-14-move-return-button-to-lobby`
  records. A third mode in the picker does not make it worse and does not fix it.
- **A multi-human Tupatro save.** `soloBoard` still gates the run slot, so a four-human match is
  not resumable, exactly as the other two match modes are not.

## Source

- **<https://korttipeliopas.fi/tuppi>** — the point table, the ryöstö doubling, the 24 for a sooli
  either way and the 52 to win. This mode reuses `dealPoints` and `TUPPI_TARGET` unchanged, so every
  one of those sentences is already implemented and tested by `points.test.ts`; nothing about
  tuppi's scoring is reinterpreted here.
- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** — the play itself: the
  declaration, maantuntopakko, sooli, the sit-out and the ryöstö. Unchanged, and the mode-blind
  `sooliCandidates` house tie-break of `2026-09-09-both-defenders-sooli` applies as it stands.
- **The contradiction, stated rather than implemented quietly.** Neither source contains a one-shot
  item a player spends mid-deal, and two of the five temput **break tuppi's own rules**:
  `kannanvaihto` changes a declaration already made, and `tikkivarkaus` hands a trick to a side that
  did not win it. The chosen reading is that **Tupatro is not tuppi and does not claim to be** — it
  is this game's name for this game's own mode, the roguelike's shell laid over a traditional deal,
  and the rules panel says exactly that in the mode's own section. What must not happen is the
  reverse: the `rules.tuppi` section describing what comes from tuppi stays free of temput, and
  Traditional Tuppi keeps playing the source's game.
- **The theft's target, which the sources cannot settle because they do not know the trick.** The
  chosen reading, to be written into the comment above it in `resolveTrick`: in **rami** the spender
  takes the trick for their own side, in **nolo** they push it onto the other side, and in **sooli**
  a defender pushes it onto the soloist (busting the sooli) while the soloist pushes it onto anyone
  else. It is read from what each side is trying to do in that deal, not from a rule sheet.
