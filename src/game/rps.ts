import { isKingOfClubs, isQueenOfClubs, makeDeck, type Mint } from "./cards";
import { RPS_ROUNDS } from "./constants";
import { ownerSeat } from "./rules";
import type { Card, GameState, RpsThrow, Seat } from "./types";

/* ============================ Rock-Paper-Scissors ============================
   This mode is not tuppi, and neither tuppi source knows it — the Oulunsalo
   senior tuppi club rule sheet (Antti Auer, 9 September 2022) and
   korttipeliopas.fi both describe a four-handed trick-taking game built on
   the rami/nolo declaration, and say nothing about a hand game. It ships the
   way Tuppi-Rummikub's laydown and Nami's point tables do — as this game's
   own side mode.

   Only the three-way cycle itself has a source: Official WRPSA Rock Paper
   Scissors Rules v1.0 <https://wrpsa.com/rules> (rock blunts scissors,
   scissors cuts paper, paper covers rock). Everything else here — the
   suit-to-throw mapping, aluminium foil as a fourth throw, the two clubs as
   trumps, and playing exactly three rounds with no replay of a tie — is this
   game's own invention, and overrules WRPSA's own replayed tie and
   first-to-two match: the requirement asks for exactly three rounds, most
   wins takes it, which cannot fit a replay inside a fixed length.

   Four throws cannot be a fair table, and that is arithmetic rather than a
   choice left half-made: six pairs over four throws is 1.5 wins each, so a
   table where every pair of *different* throws is decided cannot give them
   equal strength. The alternative — tying the two diagonal pairs of a
   four-cycle, which is fair — cannot keep WRPSA's three edges, because those
   three already close a cycle of their own and no longer cycle can contain
   it. So the edges stay, the asymmetry is accepted and written down: scissors
   and foil win two pairings each, rock and paper one. It is an asymmetry
   *between throws*, never between players — both sides reveal from the same
   deck, so neither is favoured, which is what the README measures.

   No wallet, no boss — the same shape points.ts and nami.ts have, so this
   stays part of the pure core and is testable with no reducer at all. */

export const RPS_THROWS: RpsThrow[] = ["rock", "paper", "scissors", "foil"];

/* What each throw beats. The first three rows are WRPSA v1.0's own cycle —
   rock blunts scissors, scissors cuts paper, paper covers rock — and foil's
   row is this game's own, with one rationale behind all of it: foil wraps
   whatever it meets, and only scissors cut it. A matching pair is a tie both
   ways, since no throw appears in its own row. */
const BEATS: Record<RpsThrow, RpsThrow[]> = {
  rock: ["scissors"],
  paper: ["rock"],
  scissors: ["paper", "foil"],
  foil: ["rock", "paper"],
};

export function beats(a: RpsThrow, b: RpsThrow): boolean {
  return BEATS[a].includes(b);
}

/* The mode's deck is the ordinary 52, all four suits, because all four suits
   are throws now: the fourth is aluminium foil, and a deck holding only the
   two club honours would leave that throw unplayable. It is makeDeck rather
   than a deck of its own so the mode cannot drift from the card the rest of
   the game mints, and it takes the reducer's own Mint for the usual reason —
   uidSeq lives in the state, never in a module. */
export function makeRpsDeck(mint: Mint): Card[] {
  return makeDeck(mint);
}

/* Suits are throws — ♥ paper, ♠ rock, ♦ scissors, ♣ aluminium foil, the
   requirement's own mapping with no source for it. The ♣K and ♣Q are the one
   exception: they are the deck's two honours, decided ahead of this table in
   rpsCompare, so they are clubs without being a throw. Every other club is
   foil like any other suited card is its own throw. */
export function rpsThrowOf(c: Card): RpsThrow | null {
  if (isKingOfClubs(c) || isQueenOfClubs(c)) return null;
  if (c.s === "H") return "paper";
  if (c.s === "S") return "rock";
  if (c.s === "D") return "scissors";
  return "foil";
}

/* 1 when a takes the round, -1 when b does, 0 for a tie. The two honours
   decide their round outright and rank never enters it anywhere else: the
   whole answer comes from suit alone, via isKingOfClubs/isQueenOfClubs (card-
   type questions, so the pair of cards a and b never has to agree with the
   rule that draws the portrait) and rpsThrowOf's suit-to-throw table. ♣K vs
   ♣Q is unreachable both ways with itself — the deck holds one of each — but
   is not special-cased: the King answers true against every other card, the
   Queen against every card but the King. An ordinary club meets another
   ordinary club as foil against foil, which is the ordinary same-suit tie. */
export function rpsCompare(a: Card, b: Card): 1 | 0 | -1 {
  if (isKingOfClubs(a)) return isKingOfClubs(b) ? 0 : 1;
  if (isKingOfClubs(b)) return -1;
  if (isQueenOfClubs(a)) return isQueenOfClubs(b) ? 0 : 1;
  if (isQueenOfClubs(b)) return -1;
  const ta = rpsThrowOf(a);
  const tb = rpsThrowOf(b);
  /* Both suited (neither club), the ordinary case. */
  if (ta === tb) return 0;
  if (beats(ta as RpsThrow, tb as RpsThrow)) return 1;
  return -1;
}

/* Exactly RPS_ROUNDS rounds are played, no early stop even once a side has
   already won more than half of them, and no sudden death: a drawn match
   (equal wins after three rounds) is a real outcome. */
export function rpsOver(round: number): boolean {
  return round >= RPS_ROUNDS;
}

/* 0 | 1 | "draw" — a draw is a real outcome, not "not decided yet", so it does
   not reuse null. rpsRowFor and the rpsover screen both read this, and both
   would misfile a drawn match as a loss if this returned null for it. */
export function rpsWinner(wins: [number, number]): 0 | 1 | "draw" {
  if (wins[0] > wins[1]) return 0;
  if (wins[1] > wins[0]) return 1;
  return "draw";
}

/* Two players, not four: the human is the run owner and the opponent sits to
   its left. The other two chairs sit out entirely and nothing ever schedules
   them — a first-class "two-seat" notion would touch the seat machinery of
   every other mode for one side game. */
export function rpsFoe(g: GameState): Seat {
  return ((ownerSeat(g) + 1) % 4) as Seat;
}
