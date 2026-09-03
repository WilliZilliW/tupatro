/* Seeded randomness: the same seed replays the same run, which is the basis
   of the whole balance measurement. */
import { describe, expect, it } from "vitest";
import { gameReducer } from "./reducer";
import { SEED_ALPHABET, makeRng, makeSeed, normalizeSeed, seedHash } from "./rng";
import { createRun } from "./state";
import { SUITS } from "./constants";
import { PARTY_IDS } from "./content";
import { playRun } from "../test/bot";
import type { GameState } from "./types";

const handsOf = (g: GameState) => g.hands.map((h) => h.map((c) => c.id).join(",")).join("|");
const dealWith = (seed: string) => handsOf(gameReducer(createRun(seed), { type: "startBlind" }));

describe("seeds", () => {
  it("deals the same cards for the same seed", () => {
    expect(dealWith("TUPPI")).toBe(dealWith("TUPPI"));
  });

  it("deals differently for a different seed", () => {
    expect(dealWith("TUPPI")).not.toBe(dealWith("NOLO"));
  });

  it("deals all 52 cards", () => {
    expect(dealWith("TUPPI").split("|").join(",").split(",")).toHaveLength(52);
  });

  it("normalises the seed to upper case", () => {
    expect(createRun("  tuppi  ").seed).toBe("TUPPI");
    expect(dealWith("  tuppi  ")).toBe(dealWith("TUPPI"));
    expect(normalizeSeed(" nolo ")).toBe("NOLO");
  });

  it("draws a new seed for an empty one", () => {
    expect(createRun("").seed).toHaveLength(8);
    expect(createRun().seed).toHaveLength(8);
    expect(createRun("OMASIEMEN").seed).toBe("OMASIEMEN");
  });

  it("draws generated seeds from unambiguous characters only", () => {
    expect(
      makeSeed()
        .split("")
        .every((ch) => SEED_ALPHABET.includes(ch)),
    ).toBe(true);
    expect(makeSeed() + makeSeed() + makeSeed()).not.toMatch(/[O0I1]/);
  });

  it("hashes seeds stably and separately", () => {
    expect(seedHash("TUPPI")).toBe(seedHash("TUPPI"));
    expect(seedHash("TUPPI")).not.toBe(seedHash("TUPPJ"));
  });
});

describe("the generator", () => {
  it("stays in [0,1) and does not stick", () => {
    const rng = makeRng(seedHash("RNGTEST"));
    const draws = Array.from({ length: 500 }, () => rng.next());
    expect(draws.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(draws).size).toBeGreaterThan(450);
  });

  it("replays from the same state", () => {
    const a = makeRng(seedHash("RNGTEST"));
    const b = makeRng(seedHash("RNGTEST"));
    const draw = (r: ReturnType<typeof makeRng>) =>
      Array.from({ length: 500 }, () => r.next()).join(",");
    expect(draw(a)).toBe(draw(b));
  });

  /* The generator's state belongs to the game state, so the reducer is pure:
     the same state and the same action give the same result however many
     times it runs. StrictMode leans on this. */
  it("makes the reducer idempotent for the same input", () => {
    const before = createRun("PURITY");
    const once = gameReducer(before, { type: "startBlind" });
    const twice = gameReducer(before, { type: "startBlind" });
    expect(handsOf(once)).toBe(handsOf(twice));
    expect(once.rngState).toBe(twice.rngState);
  });
});

describe("the shop", () => {
  const stockWith = (seed: string) =>
    (gameReducer(createRun(seed), { type: "toShop" }).shop ?? [])
      .map((i) => `${i.kind}:${i.data.id}`)
      .join(" | ");

  it("replays its stock from the seed", () => {
    expect(stockWith("KAUPPA")).toBe(stockWith("KAUPPA"));
    expect(stockWith("KAUPPA")).not.toBe(stockWith("KAUPPA2"));
  });

  it("stocks every slot", () => {
    const g = gameReducer(createRun("KAUPPA"), { type: "toShop" });
    expect(g.shop).toHaveLength(g.shopSlots);
  });
});

/* The strongest replay test: a whole run played twice with the same seed and
   the same decisions. */
describe("whole-run replay", () => {
  it("plays out identically for the same seed and the same decisions", () => {
    const a = playRun("REPLAY", undefined, 4);
    const b = playRun("REPLAY", undefined, 4);
    expect(a.deals).toEqual(b.deals);
    expect(a.outcome).toBe(b.outcome);
    expect(a.state.money).toBe(b.state.money);
    expect(a.state.ante).toBe(b.state.ante);
    expect(handsOf(a.state)).toBe(handsOf(b.state));
  });

  it("diverges for a different seed", () => {
    const a = playRun("REPLAY", undefined, 4);
    const c = playRun("REPLAY2", undefined, 4);
    expect(a.deals).not.toEqual(c.deals);
  });
});

/* The party split is rolled from the seed too, but from a seed derived from
   it: adding parties must not shift a single deal for an existing seed. */
describe("the party split", () => {
  const map = createRun("PUOLUE").partyMap;

  it("keys all 52 cards and gives every party four of them", () => {
    const ids: string[] = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) ids.push(s + r);
    expect(Object.keys(map).sort()).toEqual(ids.sort());
    for (const p of PARTY_IDS) expect(Object.values(map).filter((x) => x === p)).toHaveLength(4);
  });

  it("gives every party exactly one card in each suit", () => {
    for (const s of SUITS) {
      const inSuit = Array.from({ length: 13 }, (_, i) => map[s + (i + 2)]);
      expect(inSuit.slice().sort()).toEqual(PARTY_IDS.slice().sort());
    }
  });

  /* One permutation per suit, so the party is independent of the rank as well
     as the suit: "all the aces are party X" is not the case. */
  it("does not make the party a function of the rank", () => {
    const mixed = Array.from({ length: 13 }, (_, i) => i + 2).filter(
      (r) => new Set(SUITS.map((s) => map[s + r])).size > 1,
    );
    expect(mixed.length).toBeGreaterThan(0);
  });

  it("replays from the seed and differs between seeds", () => {
    expect(createRun("PUOLUE").partyMap).toEqual(map);
    expect(createRun("TOINEN").partyMap).not.toEqual(map);
  });

  /* If the roll consumed the run's own generator, every deal, boss and shop
     roll for an existing seed would move — and no other test compares a deal
     against anything but another deal. */
  it("leaves the run's generator exactly where the seed put it", () => {
    expect(createRun("TUPPI").rngState).toBe(seedHash("TUPPI") | 0);
  });

  it("starts every party at zero support", () => {
    const g = createRun("PUOLUE");
    expect(Object.keys(g.support).sort()).toEqual(PARTY_IDS.slice().sort());
    expect(Object.values(g.support).every((n) => n === 0)).toBe(true);
  });
});
