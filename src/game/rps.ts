import { isKingOfClubs, isQueenOfClubs, isSofia, makeDeck, type Mint } from "./cards";
import { RPS_ROUNDS, teamOf } from "./constants";
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

   Sofia (the ♥Q) is a third exception on top of the two club honours, and
   the only one that loses rather than wins: she always loses her round,
   whatever she meets, even another heart of higher rank than her own — a
   same-throw pairing is settled by rank everywhere else (see
   2026-09-25-rps-draw-higher-card-wins below), but not for her. This game's
   own invention again, with no source anywhere; she is `isSofia` from
   `cards.ts`, the same card Politiikka already reads, chosen for the same
   reason a second time — the mode needed a card nothing else in this table
   was already using.

   2026-09-25-rps-draw-higher-card-wins: a same-throw pairing between two
   ordinary cards no longer ties. The card with the higher rank wins, ace
   high — the same order tuppi's own currentWinner uses for a led suit. The
   deck holds one of each card, so after this every round in a real match has
   a winner; a drawn match (equal wins after RPS_ROUNDS rounds) still stands.
   This reverses 2026-09-19-card-based-rock-paper-scissors's own tie reading
   and has no source of its own — a house rule, chosen because the requirement
   asked for it by name. The two club honours and Sofia are decided ahead of
   rank and are unaffected: rank only ever breaks a tie between two ordinary
   throws of the same suit.

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
   requirement's own mapping with no source for it. Three cards are the
   exception: the ♣K and ♣Q, the deck's two honours, and Sofia the ♥Q — all
   three are decided ahead of this table in rpsCompare, so none of them is a
   throw. Every other club is foil and every other heart is paper, like any
   other suited card is its own throw. */
export function rpsThrowOf(c: Card): RpsThrow | null {
  if (isKingOfClubs(c) || isQueenOfClubs(c) || isSofia(c)) return null;
  if (c.s === "H") return "paper";
  if (c.s === "S") return "rock";
  if (c.s === "D") return "scissors";
  return "foil";
}

/* 1 when a takes the round, -1 when b does, 0 for a tie. Three cards decide
   their round outright ahead of rank — isKingOfClubs/isQueenOfClubs/isSofia
   (card-type questions, so the pair of cards a and b never has to agree with
   the rule that draws the portrait) and rpsThrowOf's suit-to-throw table.
   Sofia is checked first because "always" means always — she loses even to
   the ♣K, though that King would have beaten her anyway as an ordinary heart,
   so the ordering only actually matters for the antisymmetry proof, never
   for a real match: the deck holds one of each of the three, so no two of
   them ever meet. She is her own one exception: `isSofia(a) ? 0 : -1` rather
   than a bare -1, because rpsCompare(x, x) has to answer 0 for every card —
   the deck holds one ♥Q, so Sofia meeting herself is not a real round, but
   the antisymmetry proof asks the question of every card against itself, and
   a bare -1 would fail it only for her, the same trap a bare true/false on
   the two club honours would have been if they did not already special-case
   themselves the same way below. ♣K vs ♣Q is the one honour pairing that is
   actually reachable in a match, and is not special-cased beyond the King
   answering true against every other card and the Queen against every card
   but the King. An ordinary club meets another ordinary club as foil against
   foil, and — since 2026-09-25-rps-draw-higher-card-wins — a same-throw
   pairing is no longer a tie: the higher rank wins, ace high (`Card.r`
   2..14), the same order tuppi's own currentWinner uses for a led suit. This
   is the requirement's own house rule with no source of its own, reversing
   2026-09-19-card-based-rock-paper-scissors's "two cards of the same suit
   tie the round" — chosen because the deck holds one of each card, so with
   the tie-break every round in a real match has a winner. Sofia and the two
   club honours are decided above and never reach this comparison, so rank
   never overrides "always loses" or the two honours. */
export function rpsCompare(a: Card, b: Card): 1 | 0 | -1 {
  if (isSofia(a)) return isSofia(b) ? 0 : -1;
  if (isSofia(b)) return 1;
  if (isKingOfClubs(a)) return isKingOfClubs(b) ? 0 : 1;
  if (isKingOfClubs(b)) return -1;
  if (isQueenOfClubs(a)) return isQueenOfClubs(b) ? 0 : 1;
  if (isQueenOfClubs(b)) return -1;
  const ta = rpsThrowOf(a);
  const tb = rpsThrowOf(b);
  /* Both suited (neither honour). A same-throw pairing is broken by rank. */
  if (ta === tb) {
    if (a.r > b.r) return 1;
    if (a.r < b.r) return -1;
    return 0;
  }
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

/* Two players, not four. Solo it is still the run owner and the game's own
   draw to its left, exactly as before this mode could be played by a second
   person. With a second human at the table the pair playing is the owner and
   the *other* human seat, provided the two are on different teams:
   rpsCards/rpsWins are team-indexed, so two humans on the same team would
   both write the same slot and the mode could not tell them apart. That
   case — a hand-built or future plan seating humans at 0 and 2 — is not
   reachable from the lobby after this spec (the room offers only chairs 0
   and 1) and is answered with the solo fallback rather than thrown: throwing
   inside the reducer kills the deal, and a soft wrong answer is the same
   runtime-guard-not-type shape startChallenge's all-AI board already has. */
export function rpsSeats(g: GameState): [Seat, Seat] {
  const own = ownerSeat(g);
  const humans = g.seats.reduce<Seat[]>((acc, kind, p) => {
    if (kind === "human") acc.push(p as Seat);
    return acc;
  }, []);
  if (humans.length === 2) {
    const other = humans.find((p) => p !== own);
    if (other !== undefined && teamOf(other) !== teamOf(own)) {
      return [own, other];
    }
  }
  return [own, ((own + 1) % 4) as Seat];
}

export function rpsFoe(g: GameState): Seat {
  return rpsSeats(g)[1];
}
