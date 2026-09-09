import type { Seat, Suit, TrickType, TrickTypeId } from "./types";

export const SUITS: Suit[] = ["S", "H", "D", "C"];

/* The order a hand is laid out in, and nothing else. The colours alternate —
   ♠ ♥ ♣ ♦, black red black red — so two red suits never sit side by side and
   the boundary between them is visible without reading the pips.

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
