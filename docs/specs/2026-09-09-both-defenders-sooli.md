---
id: 2026-09-09-both-defenders-sooli
title: Offer sooli to both match defenders with human priority
kind: rule
status: delivered
source: https://korttipeliopas.fi/tuppi and Oulun seniorit, Antti Auer, 9 September 2022
---

# Offer sooli to both match defenders with human priority

## What

Either defender in Traditional Tuppi or Tuppi Race can take sooli. Humans have priority over bots.
The offer moves to the partner when declined rather than immediately starting ordinary rami.
AI defenders can accept on a conservative own-hand heuristic and complete the exchange and
readiness phases automatically through the existing host clock.

## Research and conflict recommendation

- The [club rule sheet](https://bin.yhdistysavain.fi/1578091/btMCw3K3EMDmpZGdlplu0_cKiM/Tuppi-s%C3%A4%C3%A4nn%C3%B6t.pdf)
  and <https://korttipeliopas.fi/tuppi> permit one of either defending pair's players to play
  alone. Neither source specifies priority if both want sooli. The club says the declarer
  leads, one card is exchanged privately, and the partner sits out.
- Recommendation adopted: sequential offers, humans first, then bots. Within each group use
  clockwise declaration order starting left of the dealer. First acceptance settles the
  soloist; decline passes to the next candidate. Both passing starts normal rami.
- This tie-break is a **house rule**, not a claimed traditional rule. It rotates with the
  dealer, works in hot seat and across browsers, and never rewards the fastest connection.
- Alternatives considered: collect both choices before applying the same tie-break (more
  waiting and response state); require partners to agree after two acceptances (extra phase
  and possible deadlock); first network arrival wins (unfair latency/host advantage).

## Acceptance criteria

- [x] Both match modes' declared rami offers both defenders, never declaring players or nolo.
- [x] A human receives priority over an AI partner regardless of absolute seat or dealer.
- [x] Two humans or two bots use declaration order; first decline reaches the second, second
      decline resumes rami; accepting prevents the other from taking over.
- [x] Wrong seat, wrong phase, repeated and stale responses cannot steal an offer or exchange
      a card twice. Human actions cannot act for AI seats.
- [x] AI acceptance and discard choices use only their own hand, without random draws or
      hidden partner/opponent knowledge. Acceptance requires at most one 10–K and at least
      one A, 2 or 3 in every occupied suit; discard the highest sooli rank, ace low.
- [x] AI exchange and readiness are automatic through `nextTick`, which never acts for a human;
      `aiSooli` carries and guards both seat and phase. Hot seat and fixed network seats still
      expose the correct decision. No new timer site or state field.
- [x] The private random partner return uses a UID-sorted copy in both match modes, so local
      hand sorting/reordering (including duplicate faces) cannot change the drawn card or
      desync peers. The main game's original draw order is untouched.
- [x] Three-card sooli proceeds with declarer leading, ace low, soloist last, partner sitting
      out. Traditional 24-point outcomes/reset and Race scoring stay unchanged, including
      nobody scoring a busted sooli in Race. No other scoring rule changes.
- [x] Main game retains its single human-defender offer, no bot sooli and seeded results.
- [x] Both locales explain sequential priority and label decline as passing this offer, not
      promising normal play. Only the active human has decision controls; other seats see
      named waiting, not exchanged cards. `ModeBox` identifies the actual soloist.
- [x] `NET_VERSION` advances to 4; `aiSooli` is classified `auto` and validated; old v3 builds
      are refused and host/guest replay agrees through second offers/AI phases and local
      partner-hand reorderings.
- [x] Tests, mutation checks, lint, typecheck, formatting, build and browser layout pass.
- [x] Headless pace/AI-sooli measurements for both modes replace now-obsolete README figures.

## Assumptions

- User was unavailable when asked about tie-break and scope, and explicitly asked autonomous
  decisions. The recommended sequential rule was selected. The user subsequently explicitly
  extended scope to Tuppi Race; both match modes now share it, not the main roguelike game.
- Human-over-bot priority is the user's rule. Offering the human first enforces it without
  needing to store or reveal the bot's intent. A human who declines has passed for that deal.
- Keep the existing private random return card from partner; changing partner's choice or
  letting humans choose a return card is a separate rule/UI decision, not this fix. A canonical
  UID-sorted copy makes that random draw replay-safe in matches without changing the rule.
- Keep the current branch; no commit or push requested.

## Touch points

- `src/game/reducer.ts`, `rules.ts`, `ai.ts`, `schedule.ts`, `actions.ts` and tests — candidates,
  guarded responses, deterministic AI decisions and automatic exchange/readiness.
- `src/net/protocol.ts`, network tests — auto-action classification, version and lockstep.
- `src/components/panels/SooliOffer.tsx`, `Panels.tsx`, hand `Hand.tsx` / `Hint.tsx`, table
  `ModeBox.tsx`, catalogues and tests — active-human controls, private exchange, named waiting,
  priority/pass text and actual soloist labels. The rules panel consumes the updated catalogues.
- `README.md`, `CLAUDE.md`, `docs/multiplayer.md` — rule, assumptions, measured effects.

## Test plan

- Game tests: both modes, every dealer/defending pair and human/AI mix; ordered declines,
  first acceptance, no nolo/declarer offers, stale/wrong-seat/wrong-phase refusals and no
  repeated exchange. Pin the main game's single-human offer and unchanged seeded results.
- Bot/scheduler tests: acceptance and refusal boundary hands, own-hand isolation, no
  acceptance RNG, ace-low highest discard, AI-only ticks through all three phases, declarer
  leading and soloist last. Check unchanged held/bust scoring and traditional reset banking.
- Protocol/session tests: validated `auto` action, literal v3 rejection, host/guest second
  offers and AI phases, plus partner-hand sorting/reordering with duplicate faces before
  canonical return. Compare state hashes and RNG state after the exchange.
- Render tests in both locales: controls only for the active human, named waiting elsewhere,
  no exchanged-card leak to another seat, actual soloist in `ModeBox`, and read-only table.
  Browser checks must cover hot seat, fixed network seats, phone and short-window layouts.
- Run mutation checks and final typecheck, tests, lint, formatting and build. Headless pace
  samples check independent banking totals after every deal, not just the final winner.

## Implementation and verification record

Implemented and verified in the working tree; no commit or push made for this increment.

- Final gates: **2,043 tests**, lint, typecheck, repository-wide formatting check, production
  build and `git diff --check` passed; editor diagnostics empty. A final focused audit approved
  the fixes and independently passed 1,366 targeted tests.
- Mutation checks caught reverting Race coverage (16 failures), panel/pass-label protection
  (24), hand exchange dispatch guards (16), canonical return ordering (16/16 relay cases),
  and actual-soloist wording (36). Every mutation was restored before final gates.
- Browser: real components and reducer in ephemeral injected contexts, both modes and both
  locales at **1280×500** and **390×844**. Accept/pass controls were visible and hit-testable,
  with no horizontal page overflow. First human passed to the second, who accepted, sorted
  by rank, exchanged a hand card and started play. The waiting partner had no private panel
  and saw the named soloist, not “You play alone”.
- Browser AI fixture: human seat 3 preceded AI seat 1; after passing, real `nextTick` actions
  advanced offer → exchange → readiness → play in both modes/locales. No AI/private controls
  appeared for the waiting human. Actual `useSeatSync` followed seat 1 → 3 offline and stayed
  at assigned seat 1 with a fixed network-seat argument, in both modes.
- These browser probes did not create a live WebRTC session, measure network latency, or use
  a physical phone. Automatic actions were stepped through `nextTick`, not wall-clock timing.

The final headless measurement uses the **canonical UID-sorted return**, superseding all
intermediate noncanonical runs. Full tables and policy definitions are in
[README balance](../../README.md#the-race): 400 `TRAD0`…`TRAD399` seeds for each of A/B/C in
each mode via `playRace(seed, policy, 1, 1000, mode)`, nearest-rank p10/p90. A uses AI
declaration/card play at the human seat but declines human sooli; B is `basicPolicy`; C accepts
every human offer. Bots may accept in all three, so A is **not fully symmetric sooli play**.

- All **2,400 matches / 34,972 deals** completed without stalls. Independent banking replay
  agreed after every deal. Traditional reset counts A/B/C: **5,035 / 1,660 / 801**.
- A pace: Race median **8**, mean **8.0875**; Traditional median **30**, mean **39.265**,
  maximum **284**. Baseline `4863da9` was Race mean 8.0725 / median 8 and Traditional mean
  41.835 / median 30.5 / maximum 225. The mean fell, but the traditional maximum grew.
- Conservative does not mean optimal: Traditional A bots accepted **170 of 18,591 offers**,
  held 72 and busted 98 (about 58%). No claim of optimal play or bounded match length.
- Main-game `SEED0`…`SEED199`: unchanged **1,634 deals**, mean score **659.235618**. Neither
  target nor scoring was changed; Race stays cumulative/bust 0, Traditional reset/24–24.

## Out of scope

- Early ending of a lost lead and stopping näyttö at first rami (audit findings 2 and 3).
- Changing main-game balance or offers, either match's scoring or targets.
- Simultaneous bidding, partner negotiation UI, timeouts, reconnects or save migrations.
