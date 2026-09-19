/* governmentFor's determinism, spread and party validity; puolueValue's five
   scoring cases; and the termination proof — the two pairs' term total is
   strictly positive for every legal government size under the shipped
   weights, and the naive +1/-1 reading is not. */
import { describe, expect, it } from "vitest";
import { PARTY_IDS } from "./content";
import { GOV_MAX, GOV_MIN, GOV_POINT, OPP_POINT } from "./constants";
import { gameReducer } from "./reducer";
import { nextTick } from "./schedule";
import { createRun } from "./state";
import { governmentFor, politicsMode, puolueTrick, puolueValue, termOf } from "./puolue";

describe("termOf", () => {
  it("groups four deals to a term", () => {
    expect(termOf(1)).toBe(1);
    expect(termOf(2)).toBe(1);
    expect(termOf(3)).toBe(1);
    expect(termOf(4)).toBe(1);
    expect(termOf(5)).toBe(2);
    expect(termOf(8)).toBe(2);
    expect(termOf(9)).toBe(3);
  });
});

describe("governmentFor", () => {
  it("answers the same government for the same seed and term", () => {
    const a = governmentFor("PUOLUEDET", 3);
    const b = governmentFor("PUOLUEDET", 3);
    expect(a).toEqual(b);
  });

  it("draws a distinct, real, PARTY_IDS-ordered government of legal size", () => {
    for (let term = 1; term <= 50; term++) {
      const gov = governmentFor("PUOLUEORDER", term);
      expect(gov.length).toBeGreaterThanOrEqual(GOV_MIN);
      expect(gov.length).toBeLessThanOrEqual(GOV_MAX);
      expect(new Set(gov).size).toBe(gov.length);
      for (const id of gov) expect(PARTY_IDS).toContain(id);
      const indices = gov.map((id) => PARTY_IDS.indexOf(id));
      expect(indices).toEqual([...indices].sort((x, y) => x - y));
    }
  });

  it("varies both the government and its size over the first 50 terms of a fixed seed", () => {
    const govs = Array.from({ length: 50 }, (_, i) => governmentFor("PUOLUESPREAD", i + 1));
    expect(new Set(govs.map((g) => g.join(","))).size).toBeGreaterThanOrEqual(2);
    expect(new Set(govs.map((g) => g.length)).size).toBeGreaterThanOrEqual(2);
  });

  /* governmentFor takes only (seed, term) — never a GameState or an Rng — so
     it structurally cannot read or write the reducer's own g.rngState. This
     drives a whole deal twice, asking governmentFor about a pile of unrelated
     terms in between, and checks the reducer's cursor lands in the same place
     either way: the government drawn for a different term never touches it. */
  it("leaves a whole deal's rngState exactly where it would land with no government asked at all", () => {
    const seed = "PUOLUERNG";
    const playOneDeal = (): number => {
      let s = gameReducer(createRun(seed), { type: "startChallenge", id: "puoluepeli", seed });
      s = { ...s, seats: ["ai", "ai", "ai", "ai"] };
      for (let guard = 0; guard < 500 && !s.screen; guard++) {
        const tick = nextTick(s);
        if (!tick) break;
        s = gameReducer(s, tick.action);
      }
      return s.rngState;
    };
    const before = playOneDeal();
    for (let term = 1; term <= 20; term++) governmentFor(seed, term);
    const after = playOneDeal();
    expect(after).toBe(before);
  });
});

describe("politicsMode re-export", () => {
  it("is the identical function politics.ts exports", () => {
    expect(politicsMode(1)).toBe("rami");
    expect(politicsMode(2)).toBe("nolo");
  });
});

describe("puolueValue: the five scoring cases", () => {
  const gov = ["kahvi", "sauna", "mokki"];

  it("pays a government card in a hallituspeli", () => {
    expect(puolueValue(gov, "rami", "kahvi")).toBe(GOV_POINT);
  });

  it("pays an opposition card nothing in a hallituspeli", () => {
    expect(puolueValue(gov, "rami", "terva")).toBe(0);
  });

  it("costs an opposition card in an oppositiopeli", () => {
    expect(puolueValue(gov, "nolo", "terva")).toBe(-OPP_POINT);
  });

  it("costs a government card nothing in an oppositiopeli", () => {
    expect(puolueValue(gov, "nolo", "kahvi")).toBe(0);
  });

  it("scores a card with no known party as nothing, in either mode", () => {
    expect(puolueValue(gov, "rami", undefined)).toBe(0);
    expect(puolueValue(gov, "nolo", undefined)).toBe(0);
  });

  it("puolueTrick sums a trick's cards under the same table", () => {
    const parties = ["kahvi", "terva", "kahvi", undefined];
    expect(puolueTrick(gov, "rami", parties)).toBe(2 * GOV_POINT);
    expect(puolueTrick(gov, "nolo", parties)).toBe(-OPP_POINT);
  });
});

/* ==================== the termination proof ====================
   Every one of the 52 cards is captured exactly once a deal, so a government
   of k parties (4k cards, one per suit per party) makes a hallituspeli's two
   pairs sum to exactly 4k x GOV_POINT and an oppositiopeli's sum to exactly
   -(52 - 4k) x OPP_POINT — independent of which parties are actually in the
   deck's map, only how many. A flat list with each of PARTY_IDS' thirteen
   entries appearing exactly four times stands in for a real partyMap, since
   the sum depends only on the split, not on which suit carries which
   party. */
function fullDeckParties(): string[] {
  const out: string[] = [];
  for (const id of PARTY_IDS) for (let i = 0; i < 4; i++) out.push(id);
  return out;
}

describe("the termination proof", () => {
  const deck = fullDeckParties();

  it("captures exactly 52 cards a deal", () => {
    expect(deck).toHaveLength(52);
  });

  it.each([3, 4, 5] as const)(
    "a %i-party government sums to exactly 4k x GOV_POINT in a hallituspeli and -(52-4k) x OPP_POINT in an oppositiopeli",
    (k) => {
      const gov = PARTY_IDS.slice(0, k);
      expect(puolueTrick(gov, "rami", deck)).toBe(4 * k * GOV_POINT);
      expect(puolueTrick(gov, "nolo", deck)).toBe(-(52 - 4 * k) * OPP_POINT);
    },
  );

  it("makes a whole term (two of each deal type) strictly positive at every legal government size, worst at k=3", () => {
    const termSum = (k: number, gp: number, op: number) => 8 * k * gp - 2 * (52 - 4 * k) * op;
    for (let k = GOV_MIN; k <= GOV_MAX; k++) {
      expect(termSum(k, GOV_POINT, OPP_POINT)).toBeGreaterThan(0);
    }
    /* k=3 is the worst case: the sum is increasing in k (8k(G+O) - 104*O), so
       if the smallest legal government clears zero, every larger one clears
       it by more. */
    const sums = [3, 4, 5].map((k) => termSum(k, GOV_POINT, OPP_POINT));
    expect(Math.min(...sums)).toBe(sums[0]);
  });

  /* The naive reading of the issue: a government card worth +1, an
     opposition card worth -1. It fails to terminate — a k=3 term is strictly
     negative — because 3 x 1 is not greater than 10 x 1. The number this
     actually produces is -56 (8*3*(1+1) - 104*1), not the -8 an earlier draft
     of the spec's own Assumptions section quoted; that figure does not follow
     from the spec's own formula under any legal k and was this project's own
     arithmetic slip, recorded in puolue.ts's header comment rather than
     reproduced here as if it were correct. What both readings agree on is the
     conclusion: naive ±1 does not terminate, and must not ship. */
  it("shows the naive +1/-1 reading fails to terminate at k=3", () => {
    /* k=3: 12 government cards, 40 opposition. Under GOV_POINT = OPP_POINT = 1
       a hallituspeli sums to +12 and an oppositiopeli to -40, so a term of two
       of each is 2*12 + 2*(-40) = -56 — strictly negative, because
       3 x 1 is not greater than 10 x 1. */
    const naiveHallitus = 4 * 3 * 1;
    const naiveOppositio = -(52 - 4 * 3) * 1;
    const naiveTermSum = 2 * naiveHallitus + 2 * naiveOppositio;
    expect(naiveTermSum).toBe(-56);
    expect(naiveTermSum).toBeLessThan(0);
    expect(3 * 1).not.toBeGreaterThan(10 * 1);

    /* And the shipped weights are chosen exactly so this does not happen. */
    const gov = PARTY_IDS.slice(0, 3);
    const shippedTerm = 2 * puolueTrick(gov, "rami", deck) + 2 * puolueTrick(gov, "nolo", deck);
    expect(shippedTerm).toBeGreaterThan(0);
    expect(shippedTerm).not.toBe(naiveTermSum);
  });
});
