---
id: 2026-09-09-traditional-tuppi-score-reset
title: Reset a traditional tuppi lead when its pair loses a deal
kind: scoring
status: delivered
source: https://korttipeliopas.fi/tuppi and Oulun seniorit, Antti Auer, 9 September 2022
---

# Reset a traditional tuppi lead when its pair loses a deal

## What

Traditional Tuppi uses the default match rule rather than the faster cumulative-score variant:
only one pair may hold points. Losing a deal while holding points returns the match to 0–0;
the winning pair earns no match points for that deal. The next deal starts a new rise.

This supersedes the independent accumulation and every-deal-advances claims in
`2026-09-08-traditional-tuppi-multiplayer-mode`, not its individual-deal point table.

## Acceptance criteria

- [x] From 0–0 the winning pair banks its normal deal points; a pair already up adds points
      when it wins again, and a total of at least 52 still ends the match.
- [x] If the pair holding points loses, both match totals and the awarded `handScore` become
      zero. No match-over screen opens, even if the unbanked deal is worth 52 or more.
- [x] Both teams are covered for rami, ryöstö, nolo and held/busted sooli. A reset followed
      by another deal awards points normally, with at most one non-zero total throughout.
- [x] Tuppi Race still accumulates independent totals; main-game and rummikub scoring stay unchanged.
- [x] Network version 3 rejects version 2's cumulative-scoring engine before play; rooms and
      invitation codes retain their existing version isolation. No wire shape changes.
- [x] The traditional deal-end screen shows zero awarded points after a reset and explains
      the 0–0 result in both languages. Rules-panel lists and README describe the reset.
- [x] Seeded headless matches remeasure the pace at 52; README replaces cumulative-era figures.
- [x] Regression tests, mutation checks, lint, typecheck, formatting and build pass.

## Verification

- 1,732 tests passed; lint, typecheck, formatting and production build passed.
- Before the fix, the new reset tests failed in ten cases. Deliberate mutations were caught:
      removing the mode gate (one failure), retaining stale `handScore` (two), showing raw reset
      points as awarded (four), and reverting network version 3 to 2 (one). All mutations restored.
- 1,200 seeded matches finished; an independent replay of raw deal values matched every final
      total. README records all three policies. Symmetric sample: median 30.5 deals, mean 41.835,
      maximum 225; target unchanged at 52.
- Browser-emulated reset results at 1280×500 and 390×844, Finnish and English: both buttons
      visible and hit-testable, no horizontal overflow. Fixture used the real reducer and result
      component with injected contexts; no live network or physical-device test was performed.
- Independent review checked banking, display and scope, and found the old-engine desync risk;
      network version 3 and its literal-v2 rejection regression address that finding.

## Assumptions

- “Fix 1” means the score-reset finding only. Deals still play all thirteen tricks unless a
  sooli busts; no early-termination, declaration or sooli-offer change belongs here.
- “Peli on pöydässä” means both totals are zero: the pair knocking the leaders down does not
  bank points until it wins a subsequent deal. This applies to every deal type, including sooli
  and ryöstö; no extra special-case scoring rule is introduced.
- `dealPoints` remains the raw point table. Resetting is a match transition, not a change to
  what a trick count is worth. No new GameState field or save migration is needed.
- No commit, push or branch switch was requested; work stays on the existing spec branch.

## Touch points

- `src/game/reducer.ts`, `src/game/reducer.test.ts` — match banking and regression coverage.
- `src/components/screens/DealEnd.tsx`, `src/test/render.test.tsx` — awarded points and reset text.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — reset explanation and rules-panel lists.
- `src/net/protocol.ts`, `src/net/session.test.ts` — reject incompatible pre-reset engines.
- `README.md`, `CLAUDE.md`, `docs/multiplayer.md` — current rules and measured pace.

## Out of scope

- Audit findings 2–4, AI tuning, early deal termination, additional scoring variants.
- Changing the target of 52, individual-deal point table or any other mode's scoring.
- Clearing existing scoreboards or migrating saves; traditional matches are never saved.

## Source

- [Oulun seniorit club sheet](https://bin.yhdistysavain.fi/1578091/btMCw3K3EMDmpZGdlplu0_cKiM/Tuppi-s%C3%A4%C3%A4nn%C3%B6t.pdf),
  Antti Auer, 9 September 2022: only one team can hold points; losing resets them.
  Keeping both teams' points is explicitly an optional faster variant.
- <https://korttipeliopas.fi/tuppi>: the pair currently up falls to zero on losing, returning
  the game to the table. Its early-stop rule is separate and remains outside this fix.
