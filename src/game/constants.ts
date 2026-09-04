import type { Suit, TrickType, TrickTypeId } from "./types";

export const SUITS: Suit[] = ["S", "H", "D", "C"];

// prettier-ignore
export const SM: Record<Suit, { g: string; red: boolean }> = {
  S:{g:"♠", red:false},
  H:{g:"♥", red:true },
  D:{g:"♦", red:true },
  C:{g:"♣", red:false}
};

export const RN: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

/* The opponents are characters, not translatable text. Only the player is
   localised, and the key is what marks them. */
export type SeatInfo = { key?: string; name?: string; short: string };

// prettier-ignore
export const SEATS: SeatInfo[] = [
  {key:"seat.you",   short:"S"},
  {name:"Raimo",  short:"R"},
  {name:"Veikko", short:"V"},
  {name:"Sirpa",  short:"I"}
];

export const rankLabel = (r: number): string => RN[r] ?? String(r);

export const isUs = (p: number): boolean => p === 0 || p === 2;

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
