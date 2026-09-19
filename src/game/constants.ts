import type { Seat, Suit, TrickType, TrickTypeId } from "./types";

export const SUITS: Suit[] = ["S", "H", "D", "C"];

/* The order a hand is laid out in, and nothing else. ♠ ♥ ♣ ♦ — every suit now
   has its own colour, so no two neighbours share one and the boundary between
   them is visible without reading the pips.

   Deliberately not `SUITS`. That one builds the deck, rolls the shop's card
   offer and rolls the party map, so reordering it would shuffle every deal,
   boss and shop roll for every existing seed: a shared seed would stop
   reproducing its run across builds, and every pinned literal in
   `seats.test.ts` would move at once — which is exactly when the golden stops
   being able to tell a deliberate change from a broken one. Layout is a
   display question and stays out of the engine. */
export const HAND_SUITS: Suit[] = ["S", "H", "C", "D"];

// prettier-ignore
export const SM: Record<Suit, { g: string; red: boolean }> = {
  S:{g:"♠", red:false},
  H:{g:"♥", red:true },
  D:{g:"♦", red:true },
  C:{g:"♣", red:false}
};

export const RN: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

/* Four characters, one per chair, and none of them is translatable text. Which
   chair the player takes is the lobby's choice, so every seat needs an
   occupant for the three configurations the player is not in it — seat 0's is
   Seija. Only the viewing seat is localised, and seatNameIn decides that from
   the seat the window is at rather than from a key on the row. The four short
   letters stay S, R, V, I: distinct, and no avatar in single player moves. */
export type SeatInfo = { name: string; short: string };

// prettier-ignore
export const SEATS: SeatInfo[] = [
  {name:"Seija",  short:"S"},
  {name:"Raimo",  short:"R"},
  {name:"Veikko", short:"V"},
  {name:"Sirpa",  short:"I"}
];

export const rankLabel = (r: number): string => RN[r] ?? String(r);

/* ==================== the partnerships ====================
   A seat's team is p % 2. Tuppi is two partnerships sitting across from each
   other and the seats are numbered clockwise, so 0 and 2 are one pair and 1
   and 3 the other. That is the same partition the old isUs expressed; who
   partners whom does not change here. What changes is that the axis is no
   longer "us and them" — nothing in the engine knows which side the player is
   on any more. */
export const teamOf = (p: Seat): 0 | 1 => (p % 2) as 0 | 1;

export const sameTeam = (a: Seat, b: Seat): boolean => teamOf(a) === teamOf(b);

export const partnerOf = (p: Seat): Seat => ((p + 2) % 4) as Seat;

/* Trick types. The follow-suit obligation makes a flush the commonest trick,
   hence its low base. */
// prettier-ignore
export const TYPES: Record<TrickTypeId, TrickType> = {
  high:    {id:"high",     chips:15,  mult:1},
  pair:    {id:"pair",     chips:25,  mult:2},
  flush:   {id:"flush",    chips:30,  mult:2},
  twopair: {id:"twopair",  chips:45,  mult:3},
  straight:{id:"straight", chips:55,  mult:3},
  trips:   {id:"trips",    chips:70,  mult:4},
  sf:      {id:"sf",       chips:110, mult:6},
  quad:    {id:"quad",     chips:150, mult:8}
};

export const ANTES = [500, 800, 1250, 1900, 2900, 4400, 6800, 10500, 16000, 25000];

/* The race mode's target, and a measured number rather than a chosen one: it
   sits beside ANTES because that is where a measured number lives. Two samples
   of 24,000 headless deals each — seeds RACE0..RACE399, sixty deals apiece —
   put a scoring pair's deal at a median of 1,992 (all four seats deciding with
   chooseAI) and 2,352 (basicPolicy at the owner), and walking each seed's deal
   sequence to 12,000 finishes a match in a median of seven deals — seven or
   eight minutes at schedule.ts's delays, with the 90th percentile at twelve.
   15,000 was measured and rejected: a median of ten deals with 6.3% of matches
   running to fifteen or more is a long sit in a mode with no shop and no ante
   screen to break it up. The figures, and how to reproduce them, are in the
   README.

   This is Tupatro's own number, not tuppi's. Real tuppi plays to 52 points of
   its own table; this game's deal score is chips × mult and its tuppi
   multiplier already *is* that table, so the two are not convertible and the
   rules panel says so. */
export const RACE_TARGET = 12_000;

/* The traditional mode's target, and unlike the race's it is not this game's
   number to pick: korttipeliopas.fi says "Peli päättyy, kun toinen joukkueista
   pääsee 52 pisteeseen." Choosing another figure would be inventing scoring.
   What falls out of it — how many deals a match takes — is measured and
   reported in the README rather than tuned. */
export const TUPPI_TARGET = 52;

/* Tupatro's supply: there is no money in a match, so the roguelike's answer
   (buy one) does not exist, and the cheapest supply that needs no economy at
   all is a draw. One per seat per deal, drawn in startDeal whatever the boxes
   already hold. A second site draws the same way: playCardInner, when the ♣K
   ("Ikiliikkuja") is played in a Tupatro deal, for the seat that played it.
   Both sites take the pick() before testing whether to keep it, so a discarded
   draw costs the same cursor movement as a kept one — what is no longer true
   is that a deal costs a *fixed* amount of randomness, since whether the ♣K
   reaches a trick (it can sit unplayed in a sooli's sitting-out hand) now
   varies that count. What survives is the narrower, true claim: what a seat
   is *holding* can never change what the *next* deal deals. A box that is
   already full simply wastes its draw, which is the only pressure to spend
   a free supply can have. */
export const TUPATRO_DRAW = 1;

/* Nami's two targets — a custom mode's own numbers, not tuppi's, so both are
   measured exactly as the race's is. The `sum = 4n` identity (nami.test.ts,
   and the spec's own termination proof) is what makes a target usable at all
   on a scale that spans negative territory: after n deals the two pairs
   always sum to 4n, so the leader is never below 2n.

   200 seeded matches per variant, all-AI, walked past every candidate target
   with the trajectory technique nami.measure.test.ts used before it was
   deleted (the reducer never issues raceover, so one simulation per seed
   answers every candidate at once). Both variants' medians land inside the
   8-20 deal band the spec sets, with a 90th percentile at or under 35:

   easy,  target 40:  median 10, mean 10.91, p90 16, max 20 (all 200 finished)
   hard,  target 140: median 15, mean 16.64, p90 31, max 52 (all 200 finished)

   40 is the easy variant's own starting guess and needed no correction. 180
   was the hard variant's starting guess and missed: at 180 the median is 21,
   past the band's top, and at the next round number down (160) the 90th
   percentile is 36, one over the ceiling. 140 is the closest round number
   below 180 that clears both bars, so it ships rather than 180. See
   README.md for the full table across every candidate tried. */
export const NAMI_TARGET = 40;
export const NAMI_HARD_TARGET = 140;

/* Rock-Paper-Scissors' own numbers, and the requirement's own rather than
   measured: exactly three rounds are played, no early stop and no replay of
   a tie, and each player is dealt one card per round. This overrules
   "Official WRPSA Rock Paper Scissors Rules v1.0" (https://wrpsa.com/rules),
   which decides a match at two wins and replays a tie — see rps.ts's own
   comment for the disagreement. Against a uniform opponent there is no lever
   to tune either number — see rps.test.ts and the README for the uniformity
   measurement instead. */
export const RPS_ROUNDS = 3;
export const RPS_HAND = 3;

/* Politiikka's own target — a custom mode's own number, not tuppi's, measured
   the same way the race's and Nami's are: 200 seeded matches, all AI, walked
   past every candidate with the trajectory technique (raceScores never
   resets here, so one simulation per seed answers every candidate at once).
   100, the scale-derived starting point, already clears the spec's band —
   median 18 deals, mean 17.545, p90 22, max 26, all 200 finished — so it
   ships unchanged, the same way Nami's easy variant's own starting guess did.
   See README.md for the full candidate table. */
export const POLITIIKKA_TARGET = 100;

/* Puoluepeli's own numbers — GitHub issue #63, and every one of them this
   game's own invention rather than tuppi's or the issue's own (see
   puolue.ts's header comment): neither source gives a card a party or a
   government any effect at all.

   PUOLUE_TERM (4) and GOV_MIN/GOV_MAX (3/5) are the issue's own numbers,
   spelled out rather than measured: "peliä pelataan neljä kierrosta" and
   "3-5 puoluetta hallitukseen".

   GOV_POINT and OPP_POINT are not: the issue's own literal ±1 does not
   terminate (see puolue.ts's own comment for the proof), so they are
   separate constants, constrained by 3 x GOV_POINT > 10 x OPP_POINT (the
   worst case is a 3-party government), and measured rather than guessed for
   the shipped pair — see README.md for the candidate table. */
export const PUOLUE_TERM = 4;
export const GOV_MIN = 3;
export const GOV_MAX = 5;
export const GOV_POINT = 4;
export const OPP_POINT = 1;

/* Puoluepeli's own target, measured the same way the race's, Nami's and
   Politiikka's are: 200 seeded matches per candidate (GOV_POINT, OPP_POINT)
   pair (all satisfying the inequality above), all AI, played to a fixed large
   deal count with the real target replaced by an unreachable one so a single
   simulation's trajectory answers every candidate round target at once
   (raceScores never resets here). Three weight pairs were tried, each with
   its own round target that clears the spec's band (median 8-20 deals, p90
   at 36 or fewer):

     (4,1), target 100:  median 9,  mean  8.800, p90 13, max 23 (all 200 finished)
     (5,1), target 150:  median 9,  mean  9.620, p90 13, max 21 (all 200 finished)
     (6,1), target 200:  median 9,  mean 10.170, p90 13, max 19 (all 200 finished)

   All three clear the band comfortably; (4,1) is the simplest pair that does
   — the smallest integer OPP_POINT (1) and the smallest GOV_POINT the
   inequality allows for it (4, since 3x4=12 > 10x1=10 while 3x3=9 is not) —
   so it ships rather than either of the other two, the same "the
   scale-derived starting point already clears the band" reasoning
   Politiikka's own target shipped under. See README.md for the full
   candidate table. */
export const PUOLUEPELI_TARGET = 100;

/* Four blinds to an ante: small, big, small boss, big boss. The two boss
   blinds draw from different pools, so an ante always shows two bosses. */
export const BLIND_MULT = [1, 1.5, 2, 2.5];

export const BLIND_REWARD = [3, 4, 5, 6];

/* Blind keys and marks as tables, so t() gets a literal key rather than a
   concatenated string — the type checks the key. The fourth mark is from the
   Geometric Shapes block, like ● and ◉, rather than a dingbat that a fallback
   font might not carry. */
export const BLIND_KEYS = ["blind.0", "blind.1", "blind.2", "blind.3"] as const;
export const BLIND_MARKS = ["●", "◉", "☠", "▲"] as const;
