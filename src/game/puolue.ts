import { PARTY_IDS } from "./content";
import { GOV_MAX, GOV_MIN, GOV_POINT, OPP_POINT, PUOLUE_TERM } from "./constants";
import { makeRng, seedHash, shuffle } from "./rng";
import type { Mode } from "./types";

/* Shared rather than respelled: politicsMode already answers "odd deal rami,
   even deal nolo", which is exactly the issue's own "joka toinen kierros on
   rami ja joka toinen nolo". Re-exported so a caller that reaches for this
   mode's own rule module finds the rotation here too, without this file
   defining a second copy of the odd/even test. */
export { politicsMode } from "./politics";

/* ============================ Puoluepeli ============================
   Neither source knows this mode at all: the Oulunsalo senior tuppi club rule
   sheet (Antti Auer, 9 September 2022) and korttipeliopas.fi both make the
   rami/nolo declaration a free clockwise choice and score a deal by its trick
   count. This mode contradicts both on purpose — GitHub issue #63, unfinished
   ("ööö...") — and ships the way Tuppi-Rummikub's laydown, Nami's point
   tables, Rock-Paper-Scissors' two clubs and Politiikka's rotation and Sofia
   card do: as this game's own invention, stated so in the rules panel and the
   README.

   No wallet, no boss, no base, no GameState — the same shape points.ts,
   nami.ts, rps.ts and politics.ts have, so this stays part of the pure core
   and is testable with no reducer at all. Every export here takes party ids,
   never cards: the caller does the partyOf(g, card) lookup, which is the only
   place this module would otherwise have needed a GameState. */

/* Four deals to a term ("the government is valid for four years"), rotating
   hallituspeli/oppositiopeli exactly as Politiikka's own deals do — imported,
   not respelled, because the two modes share one rotation. termOf(dealNo)
   turns the running deal counter (raceDeal, already state and already saved)
   into which term that deal falls in: deals 1-4 are term 1, 5-8 term 2, and
   so on, so a resumed match reads the same term it left. */
export function termOf(dealNo: number): number {
  return Math.ceil(dealNo / PUOLUE_TERM);
}

/* The government for a given term, derived from the run's seed rather than
   stored: makeRng(seedHash(...)) is the same device rollParties (state.ts)
   uses to roll the parties themselves, and for the same reason — it buys a
   government with no GameState field, no SAVE_VERSION question and nothing
   for a resumed match to disagree about, at the cost of leaving g.rngState
   exactly where it found it (a fresh, term-and-seed-salted cursor, read and
   discarded). governmentFor(seed, term) is a pure function of its own two
   arguments and nothing else, so calling it twice for the same pair always
   answers the same government.

   The size is drawn first — GOV_MIN..GOV_MAX inclusive — then that many
   parties are drawn without replacement from the full thirteen. The result is
   filtered back into PARTY_IDS' own order rather than returned in the order
   they were drawn, so a plate that lists them never reorders itself between
   two governments of the same size. */
export function governmentFor(seed: string, term: number): string[] {
  const rng = makeRng(seedHash(`${seed}:gov:${term}`) | 0);
  const size = GOV_MIN + Math.floor(rng.next() * (GOV_MAX - GOV_MIN + 1));
  const chosen = new Set(shuffle(PARTY_IDS.slice(), rng).slice(0, size));
  return PARTY_IDS.filter((id) => chosen.has(id));
}

/* What one card is worth in this mode: a government card is +GOV_POINT in a
   hallituspeli and a government card is worth 0 in an oppositiopeli; an
   opposition card is the mirror, 0 in a hallituspeli and -OPP_POINT in an
   oppositiopeli. The issue names one side per deal type and is silent about
   the other — this is the literal reading, and its consequence is that an
   oppositiopeli's best possible deal for a pair is 0, never a gain: a pair
   climbs only in the government deals and defends in the opposition ones.

   `party` is `string | undefined` because partyOf(g, card) has no fallback by
   design (see cards.ts) — a card the run's map does not know is worth 0
   rather than crediting a bucket keyed "undefined". Unreachable with the
   deck this game deals, since partyMap fills every one of the 4 x 13 keys,
   but the caller's uncertainty is real and this function does not pretend
   otherwise. */
/* `mode` is `Mode | null` because that is GameState's own field type — never
   actually null while this mode is being scored, since startDeal sets it in
   the same step it starts the deal, but the caller passes the state's field
   straight through rather than asserting past its type. A null mode (the
   pre-deal state no code path here ever reaches) scores as an oppositiopeli
   would: nothing to a government card, so nothing is silently invented for a
   deal type that was never decided. */
export function puolueValue(
  gov: readonly string[],
  mode: Mode | null,
  party: string | undefined,
): number {
  if (party === undefined) return 0;
  const inGov = gov.includes(party);
  return mode === "rami" ? (inGov ? GOV_POINT : 0) : inGov ? 0 : -OPP_POINT;
}

export function puolueTrick(
  gov: readonly string[],
  mode: Mode | null,
  parties: Array<string | undefined>,
): number {
  return parties.reduce((sum, p) => sum + puolueValue(gov, mode, p), 0);
}

/* ==================== the termination proof ====================
   Every one of the 52 cards is captured exactly once a deal (thirteen tricks
   x four cards, and there is no sooli here to leave any uncaptured), so with
   a government of k parties — 4k cards, one per suit per party — a
   hallituspeli's two pairs sum to exactly 4k x GOV_POINT (every government
   card scores, every opposition card scores 0) and an oppositiopeli's sum to
   exactly -(52 - 4k) x OPP_POINT (the mirror). A term is two of each:

     8k x GOV_POINT - 2(52 - 4k) x OPP_POINT
   = 8k(GOV_POINT + OPP_POINT) - 104 x OPP_POINT

   which is increasing in k, so its minimum over the legal range k = 3..5 is
   at k = 3: 24(GOV_POINT + OPP_POINT) - 104 x OPP_POINT, strictly positive
   iff 24 x GOV_POINT > 80 x OPP_POINT, i.e. 3 x GOV_POINT > 10 x OPP_POINT.
   That is this mode's whole termination proof: every term adds a strictly
   positive amount to the two pairs' combined total, so the leader is always
   at least half of a sum that rises without bound, and a match against a
   positive target cannot fail to end.

   The issue's own literal reading — a government card worth +1, an
   opposition card worth -1 — is GOV_POINT = OPP_POINT = 1, which fails that
   inequality (3 is not greater than 10): a k = 3 term sums to
   8*3*(1+1) - 104*1 = 48 - 104 = -56, strictly negative, so the two pairs'
   combined total drifts downwards and a match against a positive target can
   never end. (An earlier draft of this comment, and of the spec's own
   Assumptions section, quoted this figure as -8; that number does not follow
   from the formula above under any k in 3..5 and was an arithmetic slip in
   the write-up, not a different calculation — -56 is what the naive weights
   actually produce, and it is exactly as disqualifying.) GOV_POINT and
   OPP_POINT are therefore separate, measured constants rather than a ±1 pair
   — see constants.ts for the values that ship and the measurement behind
   them. */
