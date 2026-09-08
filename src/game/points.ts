import { teamOf } from "./constants";
import type { GameState } from "./types";

/* ==================== tuppi's own point table ====================
   The traditional match's whole arithmetic, and nothing else: no chips, no
   trick types, no jokers and no wallet, because a deal's worth here is its
   trick count and nothing on the table changes it. That is why this module
   takes a Pick of six live fields rather than a GameState — handed a wallet it
   could not help but read one.

   Straight from korttipeliopas.fi, quoted:
     nolo   — "Kuudella kasalla joukkue saa neljä pistettä ja jokainen kasa
               vähemmän lisää pisteitä neljällä."
     rami   — "Ramissa voittoon tarvitaan seitsemän kasaa. Seitsemästä kasasta
               saa neljä pistettä, sen jälkeen jokainen ylimääräinen kasa on
               neljän pisteen arvoinen."
     ryosto — "Ryöstetty rami on arvoltaan kaksinkertainen, eli jokainen kasa
               seitsemännestä alkaen on kahdeksan pisteen arvoinen."
     sooli  — "Jos soolaaja selviää tikeittä, pari saa 24 pistettä. Jos
               soolaaja ottaa yhdenkin tikin, ramaajat saavat 24 pistettä."

   Away from sooli this table is exactly *four times* the tuppi multiplier the
   main game already carries — tuppiInfo returns w − 6 in rami, (w − 6) × 2 on
   a ryosto and 7 − w in nolo — and points.test.ts asserts that identity so the
   two scales cannot drift apart. It is deliberately not implemented *as*
   4 × tuppiMult: tuppiInfo reads a wallet and a boss for the joker bonuses and
   the kitsas penalty, none of which exist in this mode, and the sooli row
   below is a genuine disagreement rather than a scale factor.

   That disagreement, stated plainly: on a *busted* sooli tuppiInfo returns a
   multiplier of 0 to everybody, so the main game and the race score it for
   nobody. The source gives the declarers 24 and this mode does too. Both are
   deliberate; the rules panel and the README say which mode is which.

   The chosen reading of "ramaajat": it is the pair that declared the rami,
   which is g.ramTeam. A sooli is only ever offered to a defender against a
   declared rami, so on a bust ramTeam is non-null and is the other pair from
   teamOf(sooliSeat); should it ever be null the fallback is the non-soloist's
   pair rather than scoring nobody. */

/* "Jos soolaaja selviää tikeittä, pari saa 24 pistettä." Both sooli outcomes
   are worth this, only to different pairs. */
const SOOLI_POINTS = 24;

/* Four points a trick, and eight when the rami was robbed. */
const PER_TRICK = 4;

type PointState = Pick<
  GameState,
  "tricks" | "mode" | "ramTeam" | "sooli" | "sooliBust" | "sooliSeat"
>;

/* What the deal just played is worth to each pair, team-indexed.

   Exactly one of the two is non-zero, always — including on a busted sooli,
   which is the one deal a race scores for nobody. With thirteen tricks one
   side always holds at least seven, so in rami exactly one side is at or past
   the floor and in nolo exactly one side is at six or fewer. */
export function dealPoints(g: PointState): [number, number] {
  const out: [number, number] = [0, 0];
  if (g.sooli) {
    if (g.sooliSeat === null) return out;
    const solo = teamOf(g.sooliSeat);
    if (!g.sooliBust) {
      out[solo] = SOOLI_POINTS;
      return out;
    }
    out[g.ramTeam ?? ((1 - solo) as 0 | 1)] = SOOLI_POINTS;
    return out;
  }
  for (const t of [0, 1] as const) {
    const won = g.tricks[t];
    if (g.mode === "rami") {
      if (won < 7) continue;
      /* A ryosto is a rami the *other* pair declared, and it is worth double.
         The null check is not decoration: a forced-rami deal has no declarer,
         and "nobody declared it" is not a robbery. */
      const rob = g.ramTeam !== null && g.ramTeam !== t;
      out[t] = (won - 6) * PER_TRICK * (rob ? 2 : 1);
      continue;
    }
    if (won > 6) continue;
    out[t] = (7 - won) * PER_TRICK;
  }
  return out;
}
