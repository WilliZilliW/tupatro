import { RPS_WINS } from "./constants";
import { ownerSeat } from "./rules";
import type { GameState, RpsThrow, Seat } from "./types";

/* ============================ Rock-Paper-Scissors ============================
   This mode is not tuppi, and neither tuppi source knows it — the Oulunsalo
   senior tuppi club rule sheet (Antti Auer, 9 September 2022) and
   korttipeliopas.fi both describe a four-handed trick-taking game built on
   the rami/nolo declaration, and say nothing about a hand game. It ships the
   way Tuppi-Rummikub's laydown and Nami's point tables do — as this game's
   own side mode — and its rule comes from a different source entirely:
   Official WRPSA Rock Paper Scissors Rules v1.0 <https://wrpsa.com/rules>.

   No wallet, no boss, no card — the same shape points.ts and nami.ts have,
   so this stays part of the pure core and is testable with no reducer at
   all. */

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

export function rpsOver(wins: [number, number]): boolean {
  return wins[0] >= RPS_WINS || wins[1] >= RPS_WINS;
}

export function rpsWinner(wins: [number, number]): 0 | 1 | null {
  if (wins[0] >= RPS_WINS) return 0;
  if (wins[1] >= RPS_WINS) return 1;
  return null;
}

/* Two players, not four: the human is the run owner and the opponent sits to
   its left. The other two chairs sit out entirely and nothing ever schedules
   them — a first-class "two-seat" notion would touch the seat machinery of
   every other mode for one side game. */
export function rpsFoe(g: GameState): Seat {
  return ((ownerSeat(g) + 1) % 4) as Seat;
}
