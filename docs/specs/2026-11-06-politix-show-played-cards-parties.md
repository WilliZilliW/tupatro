---
id: 2026-11-06-politix-show-played-cards-parties
title: Let Politix be played by two, three or four players, seat party members at random, show every card played onto a seat in full, and lay the party symbols side by side in the felt's bottom-left corner
kind: rule
status: proposed
source: >
  Politix rule sheet, Touko Tahkokallio / Onni Games 2009
  (<https://lautapeliopas.fi/wp-content/uploads/2009/06/Politix_ohjeet.pdf>), pp. 1, 2 and 6, read
  directly in this run. p. 1: players split into two or three parties, each player runs one
  politician. p. 2: parties chosen as players like, by lot or by agreement; parties as equal in size
  as possible; members of one party sit side by side; each party puts its symbol card near its
  politicians. p. 6: party members may not discuss or show each other their hands. This spec
  contradicts p. 2's side-by-side seating on the requester's word. Neither tuppi source (the
  Oulunsalo senior tuppi club rule sheet, Antti Auer, 9 September 2022, and
  <https://korttipeliopas.fi/tuppi>) knows this game.
---

# Let Politix be played by two, three or four players, seat party members at random, show every card played onto a seat in full, and lay the party symbols side by side in the felt's bottom-left corner

## What

The requirement came as three Finnish messages, the third overriding one clause of the second:

1. _"näytä kaikki kortit mitä pelaajalle on pelattu kokonaisuudessaan. neljän pelaajan pelissä
   pelataan kahdessa puolueessa, näytä siksi puolueiden erikoiskortit vasemmassa alakulmassa
   vierekkäin"_. Show every card played onto a player in full. A four-player game has two parties,
   so show the parties' special cards side by side in the bottom-left corner.
2. _"kahden pelaajan peli pelataan kahdella puolueella, kolmen pelaajan peli kolmella puolueella,
   neljän pelaajan peli kahdella puolueella. saman puolueen pelaajat istuvat aina vierekkäin"_. A
   two-player game has two parties, three players have three parties, four players have two parties.
   Members of one party always sit side by side.
3. _"yksinkertaista siten että puolueen pelaajien ei tarvitse istua vierekkäin vaan paikka on
   satunnainen"_. Simplify: members of a party need not sit side by side. The seat is random.

After this spec a Politix game is started with a **player count of 2, 3 or 4**. The default is 3,
which is today's game. Two players form two parties of one. Three players form today's three
parties of one. Four players form **two parties of two**: the two parties are drawn by lot from the
three, and the four seats are split between them by lot, so partners sit either side by side or
across the table. The count is picked on the single-player screen's Politix row and, for a hosted
game, in the lobby's mode picker. On the felt, every card lying in front of a seat (politician,
burnout, scandals) is drawn whole, with no overlap. The party symbol cards leave the seat piles:
one per party in play, side by side, at the bottom-left of the felt.

## Acceptance criteria

### The rule

- [ ] **The count travels on the action.** In `src/game/actions.ts`, `startChallenge` gains
      `players?: 2 | 3 | 4`, read only when `id === "politix"`. `startChallenge(prev, id, seed,
table, players)` in `src/game/reducer.ts` passes it to `startDeal`'s Politix arm (today
      `d.politix = pxSetup(rng, mint, ownerSeat(d))`), which passes it to `pxSetup`. A missing
      value, or any value other than 2, 3 or 4 (the wire's `isAction` does not validate fields), is
      read as **3**. `GameState` and `PolitixState` gain **no field**. The count of a running game
      is `px.party.filter((p) => p !== null).length`, and the "every field initialised" case in
      `invariants.test.ts` passes unedited.
- [ ] **`pxSetup(rng, mint, owner, players = 3)` in `src/game/politix.ts`.** The playing seats are
      `owner, owner+1, … owner+players−1` (mod 4). The other seats have `party` and `politicians`
      null and no hand. Then, per count:
  - **3 players: byte-identical to today.** The same Rng calls happen in the same order, so every
    existing Politix case in `politix.test.ts` and `reducer.test.ts` passes **unedited**. That
    includes setup, the single-human golden, the sitting-out seat "from owner 0 or owner 2" and the
    200-game measurement.
  - **2 players:** two parties, the first two of `shuffle(PX_PARTIES)`, one per playing seat.
  - **4 players:** two parties drawn the same way. The four seats are shuffled with the run's Rng;
    the first two get the first party and the last two get the second. The two seats of a party get
    two **different** politicians of that party.
  - A `politix.test.ts` case over 200 seeds checks the 4-player setup: exactly two distinct
    parties, two seats each, and the two politicians of a party distinct and of that party. Across
    the seeds **both** an adjacent pair (seats `s` and `s+1`) and an across pair (`s` and `s+2`)
    occur, which shows the seating is random rather than fixed adjacent. For 2 players: exactly two
    seats play, with two distinct parties, and the other two seats are null. Each count replays
    identically from its seed.
- [ ] **Only the parties in play are compared.** A new pure helper
      `pxPartiesInPlay(px): PxPartyId[]` returns the parties present in `px.party`, in `PX_PARTIES`
      order. It is the one place that answers this. `pxWinnerIds` compares only those parties, and
      the rank in `opponents` (the AI) counts only those. A `politix.test.ts` case pins it with a
      two-party end state where the absent party's all-zero counts and 0 turns would win a three-way
      comparison: `pxWinnerIds` must name one of the two playing parties. `collected` and `turns`
      keep all three keys, and the absent party's values stay 0.
- [ ] **Partners are not opponents.** In a 4-player game `pxResolve` refuses a scandal or a burnout
      aimed at the mover's partner (`badScandal` / `badBurnout`). It accepts one aimed at either seat
      of the other party. Yesterday's news may name any of the four seats. A reducer case asserts
      both. It also asserts that a take by either partner adds to the same `collected[party]`, and
      that each partner's turn adds to the same `turns[party]`. `pxResolve` itself should need no
      change, because its foe test already reads `party`; the test case is what pins it.
- [ ] **Measured, not guessed.** `politix.test.ts` gains a 200-seed all-bot sweep for 2 players and
      one for 4 players, beside the unedited 3-player sweep. Both run through
      `playPolitix(seed, cap, players)` in `src/test/bot.ts` (a new optional third parameter,
      default 3). Each sweep asserts:
  - every game reaches `politixover` within the cap, with the table and voter deck empty and all
    42 voter cards collected;
  - each party id wins **30–70 %** of the decided games **it played in**.

  README's Politix balance section gets a table for each new count: median, quartiles, 90th
  percentile, shortest and longest game, mean, wins and share per party, and draws. The 3-player
  table is unchanged. If a band fails, the implementation stops and reports. It does not retune
  needs, deck counts or the AI.

- [ ] **Versions.** `NET_VERSION` in `src/net/protocol.ts` goes from **15 to 16**, and its comment
      gains a v16 sentence: a v15 peer ignores `players` and deals three parties, so a 2- or
      4-player game diverges on action one. The pinned literal in `src/net/protocol.test.ts` moves
      with it. `SCOPE`, `guestMay`, `parseMsg`, `NetMsg` and `hashState` are unchanged
      (`politixHash` already hashes `party`). `SAVE_VERSION` and `POLITIX_SCORES_VERSION` are
      unchanged. Every document that names the current network version says 16 and gives v16's
      reason: `docs/multiplayer.md` (the "**15** draws Politix's cards…" paragraph), `README.md`
      ("`NET_VERSION` is 15 (v14 seated the mode; v15 …)") and the three `CLAUDE.md` lines that say
      "Current version **15**", "`NET_VERSION` is 15" and "The current version is **15**".

### Choosing the count

- [ ] **Single player.** The Politix row in `src/components/screens/SinglePlayer.tsx` draws a
      three-button picker under the label `px.playersLabel`. The buttons are `.kind` buttons, with
      `.on` on the chosen one, `data-players="2|3|4"` and labels `fmt(n)`. Below the picker is the
      chosen count's description (`px.players2` / `px.players3` / `px.players4`). The choice is
      component-local `useState`, default 3, and both of the row's `startChallenge` dispatches (Play
      and the replace confirmation) carry `players`. The picker buttons are plain buttons because
      they move nothing; Play stays a `MoveButton`. No other row draws the picker. A render case in
      both locales clicks "4" then Play and asserts the dispatched action carries `players: 4`. With
      no click, it must carry 3.
- [ ] **The lobby.** The net context gains `pxPlayers: 2 | 3 | 4` (default 3) and `setPxPlayers`.
      That covers `src/hooks/netContext.ts`, its no-op default and `stubNet` in
      `src/test/harness.tsx`.
  - `useNetGame.ts` writes it beside `match` / `chooseMatch` and reads it on Start through a ref, the
    way `matchRef` is read. It is sent as `players` in `start`'s `startChallenge`, where it only
    matters for `"politix"`. It is never on `GameState` and never saved; a guest learns it from the
    numbered action.
  - `ModePick` in `Lobby.tsx` draws the same picker under the Politix description while
    `net.match === "politix"`.
  - `playsChair(m, p, pxPlayers = 3)` in `src/net/seating.ts` answers `p < pxPlayers` for Politix.
    So 3 gives today's `p !== 3`, 4 gives every chair, and 2 gives chairs 0 and 1. Every reader
    passes the current count: `planFor`, `seatsFor` and `chooseMatch` in `useNetGame.ts`, and
    `plays` and the chair-assignment list in `Lobby.tsx`.
  - `setPxPlayers` frees every roster player whose chair the new count does not play, exactly as
    `chooseMatch` does.
  - `lobby.pxThree` (drawn twice in `Lobby.tsx`) is replaced by `lobby.pxChairs` for 2 and 3 ("{n}"
    chairs are in use, the game plays any chair nobody takes, and the rest sit out) and by
    `lobby.pxAllChairs` for 4 (all four chairs are in use, and the game plays any chair nobody
    takes).

  Test cases:

  - `seating.test.ts` pins `playsChair` for each count.
  - `useNetGame.test.tsx` asserts that `seatsFor()` marks chair 3 `"ai"` at 3 and lets it be
    `"human"` at 4, and that lowering the count to 2 frees a roster player in chair 2.
  - `render.test.tsx` asserts the picker is drawn only for Politix, and that at 4 neither
    `lobby.pxSitsOut` nor `lobby.pxChairs` is rendered.

- [ ] **Play again keeps the count.** `PolitixOver`'s Play again and Replay seed carry `players`,
      set to the number of non-null entries of `screen.parties`, beside the `seats` they already
      carry. A render case asserts it for a 4-player end screen (two parties of two).

### The felt and the other surfaces

- [ ] **Every card in front of a seat is drawn whole.**
  - In the Politix section of `src/index.css`, the negative-margin rule
    `.pxpile > * + *{margin-left:-46px}` and its narrow-window twin `margin-left:-38px` are deleted.
    `.pxpile` declares `flex-wrap:wrap` and a positive `gap`.
  - The overlap case in `invariants.test.ts` ("Politix's bonus-card pile overlaps") is
    **inverted**. No rule whose selector names `.pxpile` may declare a negative `margin-left` or
    `margin-inline-start`, and `.pxpile` must declare `flex-wrap:wrap`.
  - A seat's `.pxpile` holds exactly `1 + (burn ? 1 : 0) + scandals.length` faces, in this order:
    the burnout, the scandals in order, then the politician. The party symbol is no longer in it.
  - The render case that expects "exactly two faces" for a seat with no burnout and no scandal now
    expects one.
- [ ] **The party symbols lie side by side in the bottom-left corner.**
  - `PolitixBoard` in `src/components/table/PolitixTable.tsx` draws a `.pxsymbols` element as the
    **last** child of `.pxmain`, after `.pxlast`.
  - `.pxsymbols` holds exactly one `.pxparty` symbol face per party in `pxPartiesInPlay(px)`, in
    that order.
  - Each face carries `data-party`, the existing symbol icon, `px.symbol.<symbol>`, the group icon
    with `+fmt(PX_SYMBOL_BONUS)`, and the party's name (`px.party.<id>`) as a visible label. It
    keeps the existing `px.partyInfo` `title`.
  - `.pxsymbols` is a non-wrapping, non-overlapping `display:flex` row with `margin-top:auto`, so it
    sits at the bottom of the left column. `.pxfelt` still has exactly two element children.
  - Render cases in both locales:
    - a 3-player game has three `.pxsymbols > .pxparty`, and no `.pxparty` inside any `.pxpile`;
    - a 4-player game has two of them and four `.pxseat`, and the text column of each `.pxseat`
      names its party;
    - a 2-player game has two of them and two `.pxseat`.
  - The invariants case asserts that `.pxsymbols` declares `margin-top:auto`.
- [ ] **Two-party games name two parties wherever a score is listed.** The felt's `.pxscore`, the
      rail's `PolitixPlate` and `PolitixOver` list only `pxPartiesInPlay` (on the result screen,
      taken from `screen.parties`). Two new keys carry the two-party lines: `px.scoreHead2`
      `"{a} – {b}"` and `px.score2` `"{group}: {a} – {b}"`. The three-party keys are unchanged.
      `PolitixOver`'s per-group lines (today a hand-built `a – b – c` at lines 70–71) and its turn
      lines likewise list two parties in a two-party game. A render case in both locales on a
      4-player end screen asserts that the absent party's name appears nowhere in the overlay or the
      plate.
- [ ] **Text.** In `src/i18n/fi.ts` and `src/i18n/en.ts`:
  - **Add:**
    - `px.playersLabel`: fi "Pelaajia", en "Players".
    - `px.players2`: fi "Kaksi puoluetta, kummassakin yksi poliitikko.", en "Two parties of one
      politician each."
    - `px.players3`: fi "Kolme puoluetta, kussakin yksi poliitikko. Neljäs tuoli jää tyhjäksi.", en
      "Three parties of one politician each. The fourth chair sits out."
    - `px.players4`: fi "Kaksi kahden poliitikon puoluetta. Puoluetovereiden paikat arvotaan.", en
      "Two parties of two politicians each. Partners' seats are drawn by lot."
    - `px.scoreHead2`, `px.score2`, `lobby.pxChairs` and `lobby.pxAllChairs`.
  - **Remove** `lobby.pxThree`.
  - **Rewrite `challenge.politix.t`** so it says two to four players in two or three parties. While
    it is being rewritten, it also stops saying "nosta kolme toimintakorttia tai pelaa kortteja"
    (draw three, _or_ play), because drawing has been automatic since
    `2026-11-06-politix-side-piles-refill-deck`.
  - **In `rules.politix`:** the item that starts "Three parties of one player each" becomes the
    three counts. It also says that partners' seats are drawn at random (credited to the player,
    against the sheet's side-by-side seating), that partners share their party's symbol and counts,
    and that partners may not show each other their hands. The last item ("Up to three people…")
    says up to **four** people.
  - List lengths stay equal in both catalogues.
- [ ] **Docs and gates.**
  - `README.md`'s Politix section describes the three counts. It still says "single player only"
    at line 867 and "two-parties-of-two" as not supported at line 912; both change.
  - `CLAUDE.md`'s Politix paragraph describes the three counts. Today it says "the owner and the two
    seats clockwise play and `owner+3` sits out" and "the old two-parties-of-two game are not
    supported".
  - `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
    `npm test` and `npm run build` pass.
  - Layout is checked by eye in single player with 4 players at 1280x800, 1280x500, 844x390 and
    390x844. Check that:
    - there are four seat areas in the right column;
    - every pile face is fully visible, wrapping and never overlapping;
    - two symbol cards sit side by side at the bottom of the left column;
    - the hand and the action bar are on screen.

## Assumptions

- **This is `rule`, not `ui`.** It changes who plays and in which parties. It also carries a lobby
  change and a layout change. `rule` runs the most checks.
- **The third message overrides only the adjacency clause of the second.** The party sizes per
  count stand as written. "paikka on satunnainen" is read as: in a four-player game, which seats
  form a party is drawn by lot, so partners end up adjacent or across at random.
- **This contradicts the rule sheet's p. 2 ("Saman puolueen pelaajat sijoittuvat vierekkäin"), and
  the requirement wins.** Politix here is already the requester's own mode beside the sheet (the
  54-card split, the automatic draw). The rules panel and README must credit the random seating to
  the player, not to the sheet.
- **"Puolueiden erikoiskortit" is read as the party symbol cards, and that reading is a guess.** In
  this game's own Finnish catalogue, "erikoiskortit" means burnout, yesterday's news and scandal
  (`rules.politix`, `px.last.play`). Under that reading, the corner would hold the scandals and
  burnouts grouped per party. It was rejected for three reasons:
  - those cards are played onto a _player_ and act on that seat alone;
  - the first message's first sentence already asks for them to be shown in full where they lie;
  - the "therefore" ties the corner to the party count, and the symbol is the one card that belongs
    to a party rather than to a seat, so with two members it has no single seat pile to sit in.

  A reviewer who meant the other reading should send this back. Scandals and burnouts stay in their
  seat's pile.

- **"Pelaaja" means a politician at the table, human or game.** The count is chosen explicitly
  rather than inferred from how many people are in the lobby. Single player has one human and needs
  AI opponents, and the lobby already fills an empty playing chair with `pxMove`. Inferring the
  count from the roster was rejected because a host alone would have no defined game.
- **Default 3 keeps every existing game, test and figure.** Anything that does not choose a count
  gets today's game, byte for byte.
- **Which seats play is owner-relative and contiguous** (`owner … owner+n−1`). That lets the lobby
  say in advance which chairs a count uses (chairs 0 … n−1 when the host's chair is 0). The
  randomness is in the party split, not in which chairs are empty. Two players therefore sit side by
  side (owner and owner+1), as Rock-Paper-Scissors' pair does. The lobby spec's latent "owner not at
  chair 0" edge is unchanged and still out of scope.
- **In a four-player game the two parties are two of the three, by lot**, and the two members get
  distinct politicians of their party (each party has three). The sheet lets characters and parties
  be drawn by lot (p. 2).
- **The symbol card belongs to the party at every count.** The requirement asks for the corner in
  four-player games ("therefore"). Using it at two and three players too keeps one layout and one
  rule: a symbol is the party's, not a seat's. The seat's text column keeps the party name, so a
  seat can be matched to its symbol.
- **"Cards played onto a player" means the seat pile:** the burnout and the scandals, which others
  play onto it, plus the politician card that lies with them. "In full" means no overlap; a long
  pile wraps to a second line inside the seat area.
- **"Bottom-left corner" means the bottom of the felt's left column (`.pxmain`).** On a phone, the
  seats fall below `.pxmain` (`2026-11-06-politix-side-piles-refill-deck`), so the symbols sit at
  the bottom-left of the voter-card block, above the seats. That is not the felt's literal
  bottom-left.
- **The count is not remembered.** The single-player picker resets to 3 on each visit. The lobby's
  count lives as long as the window's net context.
- **The Politix board mixes counts.** `PolitixRow` stays `{ seed, result, turns, at }`. In a
  four-player game a party's turns are the sum of both partners' turns, so "won in N turns" cannot
  be compared across counts. This is not fixed here (see Out of scope); a reviewer who wants it fixed
  should ask for a board spec.
- **`NET_VERSION` is 15 on disk, and `CLAUDE.md` already says 15.** The bump is 15 → 16.
- **This spec reverses parts of four delivered specs, on purpose:**
  - `2026-11-03-add-politix-card-game-mode`, where it still stands, and
    `2026-11-04-rework-politix-three-parties`: the latter's Out of scope line "two-player games …
    or keeping the two-parties-of-two configuration as a variant". Its three-party game stays as
    the 3-player count.
  - `2026-11-04-politix-multiplayer-lobby`: `playsChair`'s fixed `p !== 3`, `lobby.pxThree`, and
    the Out of scope line "Four humans … or seating anybody in the sitting-out chair".
  - `2026-11-06-politix-stacked-bonus-cards`: "Pile up means overlapping", the negative-margin
    criterion and its invariants case, and the party symbol as the first pile face.

  `2026-11-06-politix-side-piles-refill-deck` is extended, not reversed: `.pxmain` gains a fifth
  child, `.pxsymbols`, after `.pxlast`. None of those spec files is edited.

## Touch points

- `src/game/actions.ts`: `startChallenge.players`.
- `src/game/reducer.ts`: `startChallenge` (new parameter, clamped to 3), `startDeal`'s Politix arm,
  and the `startChallenge` case at the `gameReducer` call site.
- `src/game/politix.ts`: `pxSetup(rng, mint, owner, players)`, `pxPartiesInPlay`, `pxWinnerIds`,
  the rank in `opponents`, and the header comment's seating reading.
- `src/game/politix.test.ts`, `src/game/reducer.test.ts`: setup per count, partners, the two-party
  winner, and the 2- and 4-player sweeps.
- `src/test/bot.ts`: `playPolitix(seed, cap, players)`.
- `src/net/protocol.ts`: `NET_VERSION` 16 and its comment. `src/net/protocol.test.ts`: the version
  literal.
- `src/net/seating.ts`: `playsChair(m, p, pxPlayers)`. `src/net/seating.test.ts`.
- `src/hooks/netContext.ts` and `src/hooks/useNetGame.ts` (`pxPlayers`, `setPxPlayers`, a ref,
  `start`, `planFor`, `seatsFor`, `chooseMatch`). `src/hooks/useNetGame.test.tsx`. `stubNet` in
  `src/test/harness.tsx`.
- `src/components/screens/SinglePlayer.tsx`: the Politix row's picker and its dispatches.
- `src/components/screens/Lobby.tsx`: `ModePick`'s picker, `plays`, the chair list, and
  `lobby.pxChairs` / `lobby.pxAllChairs`.
- `src/components/table/PolitixTable.tsx`: `.pxsymbols`, the pile without the symbol, and the
  two-party score lines.
- `src/components/rail/PolitixPlate.tsx` and `src/components/screens/PolitixOver.tsx`: the parties
  in play, and Play again's `players`.
- `src/index.css`, Politix section: `.pxpile` wrap, the overlap rules deleted (base and narrow
  block), and `.pxsymbols`.
- `src/i18n/fi.ts` and `src/i18n/en.ts`: the keys listed above, `challenge.politix.t` and
  `rules.politix`.
- `src/test/render.test.tsx` and `src/test/invariants.test.ts`.
- `README.md`, `CLAUDE.md` and `docs/multiplayer.md`.

## Out of scope

- Any other mode. Also `teamOf`, the shape of `g.seats`, `SAVE_VERSION` and saves (Politix stays
  unresumable).
- Five or six players, the sheet's five-player special rule, three parties at four players, and
  parties of unequal size.
- Choosing a party, a politician or a seat by hand. Adjacent-only seating.
- Randomising which chairs sit out at two or three players.
- The Politix board: a `players` column, per-count sorting or a version bump.
- Retuning needs, deck counts, `PX_HAND_MAX`, `PX_START_HAND` or the AI, even if a band fails.
- An AI that cooperates with its partner beyond sharing a party's counts (for example, passing news
  to a partner's scandal). `pxMove` treats the partner as neither a foe nor a target.
- Showing a partner's hand to the other partner, which the sheet forbids (p. 6).
- Regrouping scandals and burnouts per party (the rejected reading of "erikoiskortit").
- Animation, new art, and changes to the pile faces themselves.

## Source

- **Politix rule sheet, Touko Tahkokallio / Onni Games 2009**, read directly in this run:
  - p. 1, "Yleistä": "Pelaajat jakaantuvat kahteen tai kolmeen puolueeseen … ja jokainen pelaaja
    ohjaa yhtä poliitikkoa." Two players in two parties, three in three and four in two are all
    within this. **Agrees.**
  - p. 2, "Pelin alkuvalmistelut":
    - "Tämä jako voidaan tehdä pelaajien haluamalla tavalla: arpomalla tai yhteisellä
      päätöksellä." This spec draws by lot. **Agrees.**
    - "Jokaisessa puolueessa tulisi kuitenkin olla yhtä monta pelaajaa, mikäli mahdollista." Two
      parties of two at four players satisfies it. **Agrees.**
    - "Saman puolueen pelaajat sijoittuvat vierekkäin pelipöydän ääreen." **Contradicted** by the
      requirement's third message: seats are random. This is a house rule and is credited to the
      player in the rules panel, the README and a comment in `pxSetup`.
    - "Puolueet ottavat puoluesymbolikorttinsa hahmojensa lähettyville." Here the symbols lie
      together in the felt's corner, one per party. That is presentation only; the symbol's +1
      stays per party.
  - p. 6: "Pelin aikana saman puolueen jäsenet eivät saa keskustella kädessään olevista korteista,
    tai näyttää niitä toisilleen." Kept: only the viewing seat's hand is drawn.
- The Oulunsalo senior tuppi club's rule sheet and <https://korttipeliopas.fi/tuppi> do not apply:
  Politix is not tuppi.
