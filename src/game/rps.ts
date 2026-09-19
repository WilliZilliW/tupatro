import { isKingOfClubs, isQueenOfClubs, mkCard, type Mint } from "./cards";
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
   suit-to-throw mapping, the two clubs as trumps, and playing exactly three
   rounds with no replay of a tie — is this game's own invention, and
   overrules WRPSA's own replayed tie and first-to-two match: the requirement
   asks for exactly three rounds, most wins takes it, which cannot fit a
   replay inside a fixed length.

   No wallet, no boss — the same shape points.ts and nami.ts have, so this
   stays part of the pure core and is testable with no reducer at all. */

export const RPS_THROWS: RpsThrow[] = ["rock", "paper", "scissors"];

/* The three-way cycle — WRPSA v1.0: rock blunts scissors, scissors cuts
   paper, paper covers rock. A matching pair is a tie both ways, since no
   throw ever beats itself. */
const BEATEN_BY: Record<RpsThrow, RpsThrow> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export function beats(a: RpsThrow, b: RpsThrow): boolean {
  return BEATEN_BY[a] === b;
}

/* The 41-card deck: every heart, spade and diamond, plus the ♣K and ♣Q and no
   other club. Suits are the three throws in disguise and the two clubs are
   trumps, so no other club card has a role to play — a third club would be
   neither a throw nor a trump. Takes the reducer's own Mint, exactly like
   makeDeck, so uidSeq stays the one seat of randomness this mode spends. */
export function makeRpsDeck(mint: Mint): Card[] {
  const d: Card[] = [];
  for (const s of ["H", "S", "D"] as const)
    for (let r = 2; r <= 14; r++) d.push(mkCard(mint, s, r));
  d.push(mkCard(mint, "C", 13));
  d.push(mkCard(mint, "C", 12));
  return d;
}

/* Suits are throws — ♥ paper, ♠ rock, ♦ scissors, the requirement's own
   mapping, no source for it — and the two clubs are not: they are trumps,
   never a throw a suit compares against. */
export function rpsThrowOf(c: Card): RpsThrow | null {
  if (c.s === "H") return "paper";
  if (c.s === "S") return "rock";
  if (c.s === "D") return "scissors";
  return null;
}

/* 1 when a takes the round, -1 when b does, 0 for a tie. The two clubs decide
   their round outright and rank never enters it: the whole answer comes from
   suit alone, via isKingOfClubs/isQueenOfClubs (card-type questions, so the
   pair of cards a and b never has to agree with the rule that draws the
   portrait) and rpsThrowOf's suit-to-throw table. ♣K vs ♣Q is unreachable
   both ways with itself — the deck holds one of each — but is not special-
   cased: the King answers true against every other card, the Queen against
   every card but the King. */
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
