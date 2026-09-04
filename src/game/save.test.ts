import { describe, expect, it } from "vitest";
import { BOSSES, CONSUMABLES, JOKERS, VOUCHERS } from "./content";
import { act, advance } from "./drive";
import { gameReducer } from "./reducer";
import { SAVE_VERSION, dehydrate, rehydrate, type SavedRun } from "./save";
import { cardOffer } from "./shop";
import { createRun } from "./state";
import { basicPolicy, playBlind, playToScreen } from "../test/bot";
import { card } from "../test/factories";
import type { GameState } from "./types";

/* A run with something in every field the snapshot has to translate: owned
   jokers with real effects, a consumable, a voucher, a boss and a full shop. */
function stocked(): GameState {
  const g = createRun("SAVETEST");
  return {
    ...g,
    ante: 3,
    money: 17,
    jokers: [JOKERS[0], JOKERS[11]],
    consumables: [CONSUMABLES[0]],
    vouchers: [VOUCHERS[0].id],
    boss: BOSSES[1],
    sideDeck: [card("S", 14, "steel"), card("H", 7, "stone")],
    hands: [[card("C", 9), card("D", 3, "glass")], [], [], []],
    shop: [
      { kind: "joker", data: JOKERS[2], price: JOKERS[2].p, sold: false },
      { kind: "card", data: cardOffer("H", 12, "steel"), price: 7, sold: false },
      { kind: "consumable", data: CONSUMABLES[1], price: 3, sold: true },
      { kind: "voucher", data: VOUCHERS[2], price: 8, sold: false },
    ],
    screen: { kind: "shop" },
  };
}

const roundTrip = (g: GameState) => JSON.parse(JSON.stringify(dehydrate(g))) as unknown;

/* Every function anywhere in the tree, by path, so a failure names the field. */
function functionsIn(v: unknown, path = "save"): string[] {
  if (typeof v === "function") return [path];
  if (!v || typeof v !== "object") return [];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) =>
    functionsIn(x, `${path}.${k}`),
  );
}

describe("dehydrate", () => {
  it("keeps no function anywhere in the snapshot", () => {
    const snap = dehydrate(stocked());
    expect(functionsIn(snap)).toEqual([]);
    /* JSON drops functions and undefined silently, so an unchanged round trip
       is the proof that nothing was lost on the way to storage. */
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    expect(functionsIn(roundTrip(stocked()))).toEqual([]);
  });

  it("stores content as ids", () => {
    const snap = dehydrate(stocked());
    expect(snap.jokers).toEqual([JOKERS[0].id, JOKERS[11].id]);
    expect(snap.consumables).toEqual([CONSUMABLES[0].id]);
    expect(snap.boss).toBe(BOSSES[1].id);
    expect(snap.shop).toEqual([
      { kind: "joker", id: JOKERS[2].id, price: JOKERS[2].p, sold: false },
      { kind: "card", s: "H", r: 12, enh: "steel", price: 7, sold: false },
      { kind: "consumable", id: CONSUMABLES[1].id, price: 3, sold: true },
      { kind: "voucher", id: VOUCHERS[2].id, price: 8, sold: false },
    ]);
  });

  it("leaves out the transient view state", () => {
    const snap = dehydrate({
      ...stocked(),
      modal: "rules",
      toast: { id: 4, key: "toast.noSwapsLeft" },
      toastSeq: 4,
    }) as Record<string, unknown>;
    for (const k of ["modal", "toast", "toastSeq", "pop", "partyMap"])
      expect(Object.keys(snap)).not.toContain(k);
  });
});

describe("rehydrate", () => {
  it("gives back the very content objects, effects and all", () => {
    const back = rehydrate(roundTrip(stocked()), 0)!;
    expect(back).not.toBeNull();
    expect(back.jokers[0]).toBe(JOKERS[0]);
    expect(typeof back.jokers[0].add).toBe("function");
    expect(back.jokers[1]).toBe(JOKERS[11]);
    expect(typeof back.jokers[1].xm).toBe("function");
    expect(back.consumables[0]).toBe(CONSUMABLES[0]);
    expect(back.boss).toBe(BOSSES[1]);
  });

  it("gives back an unsold shop joker as the JOKERS entry itself", () => {
    const back = rehydrate(roundTrip(stocked()), 0)!;
    const it = back.shop![0];
    expect(it.kind).toBe("joker");
    if (it.kind !== "joker") return;
    expect(it.sold).toBe(false);
    expect(it.data).toBe(JOKERS[2]);
    expect(typeof it.data.add).toBe("function");
  });

  it("rebuilds a shop card offer from ENH rather than from the save", () => {
    const back = rehydrate(roundTrip(stocked()), 0)!;
    expect(back.shop![1]).toEqual({
      kind: "card",
      data: cardOffer("H", 12, "steel"),
      price: 7,
      sold: false,
    });
  });

  it("builds from createRun, so every state field is present", () => {
    const back = rehydrate(roundTrip(stocked()), 0)!;
    expect(Object.keys(back).sort()).toEqual(Object.keys(createRun("X")).sort());
    expect(Object.entries(back).filter(([, v]) => v === undefined)).toEqual([]);
  });

  it("restores the saved fields and resets the transient ones", () => {
    const g = { ...stocked(), modal: "seed" as const, toastSeq: 3 };
    const back = rehydrate(roundTrip(g), 0)!;
    expect(back.seed).toBe("SAVETEST");
    expect(back.ante).toBe(3);
    expect(back.money).toBe(17);
    expect(back.screen).toEqual({ kind: "shop" });
    expect(back.partyMap).toEqual(createRun("SAVETEST").partyMap);
    expect(back.modal).toBeNull();
    expect(back.toast).toBeNull();
    expect(back.toastSeq).toBe(0);
  });

  it("takes the better of the saved and the stored best ante", () => {
    const saved = roundTrip({ ...stocked(), bestAnte: 5 });
    expect(rehydrate(saved, 2)!.bestAnte).toBe(5);
    expect(rehydrate(roundTrip({ ...stocked(), bestAnte: 1 }), 4)!.bestAnte).toBe(4);
  });
});

describe("a save it cannot trust", () => {
  const broken = (edit: (s: Record<string, unknown>) => void): unknown => {
    const s = roundTrip(stocked()) as Record<string, unknown>;
    edit(s);
    return s;
  };

  it.each([
    ["not an object", null],
    ["not an object either", 42],
    ["a bare string", "tupatro"],
  ])("rejects raw that is %s", (_name, raw) => {
    expect(rehydrate(raw, 0)).toBeNull();
  });

  it("rejects a save with no version", () => {
    expect(
      rehydrate(
        broken((s) => delete s.v),
        0,
      ),
    ).toBeNull();
  });

  it("rejects a save from another version", () => {
    expect(
      rehydrate(
        broken((s) => void (s.v = SAVE_VERSION + 1)),
        0,
      ),
    ).toBeNull();
  });

  it("rejects an unknown joker id", () => {
    expect(
      rehydrate(
        broken((s) => void (s.jokers = ["ramikone", "eiolemassa"])),
        0,
      ),
    ).toBeNull();
  });

  it("rejects an unknown consumable id", () => {
    expect(
      rehydrate(
        broken((s) => void (s.consumables = ["eiolemassa"])),
        0,
      ),
    ).toBeNull();
  });

  it("rejects an unknown voucher id", () => {
    expect(
      rehydrate(
        broken((s) => void (s.vouchers = ["eiolemassa"])),
        0,
      ),
    ).toBeNull();
  });

  it("rejects an unknown boss id", () => {
    expect(
      rehydrate(
        broken((s) => void (s.boss = "eiolemassa")),
        0,
      ),
    ).toBeNull();
  });

  it("rejects an unknown joker id in the shop", () => {
    const raw = broken((s) => {
      (s.shop as Record<string, unknown>[])[0].id = "eiolemassa";
    });
    expect(rehydrate(raw, 0)).toBeNull();
  });

  it("rejects an unknown enhancement on a hand card", () => {
    const raw = broken((s) => {
      (s.hands as Record<string, unknown>[][])[0][1].enh = "timantti";
    });
    expect(rehydrate(raw, 0)).toBeNull();
  });

  it("rejects an unknown enhancement on a side-deck card", () => {
    const raw = broken((s) => {
      (s.sideDeck as Record<string, unknown>[])[0].enh = "timantti";
    });
    expect(rehydrate(raw, 0)).toBeNull();
  });

  it("rejects an unknown enhancement on a shop card offer", () => {
    const raw = broken((s) => {
      (s.shop as Record<string, unknown>[])[1].enh = "timantti";
    });
    expect(rehydrate(raw, 0)).toBeNull();
  });

  it("accepts a card with no enhancement", () => {
    expect(rehydrate(roundTrip(stocked()), 0)).not.toBeNull();
  });
});

/* ==================== the round trip that matters ====================
   A joker restored as a plain { id } object would pass every shape test above
   and then quietly score nothing. The proof is that the reloaded run plays on
   exactly like the one it was taken from. */

/* Plays until a joker with a scoring effect is owned and the shop is open. */
function runWithJoker(seed: string): GameState {
  let s = createRun(seed);
  for (let i = 0; i < 24; i++) {
    s = playBlind(s, basicPolicy);
    while (s.screen?.kind === "dealend")
      s = playToScreen(advance(gameReducer(s, { type: "nextDeal" })), basicPolicy);
    if (s.screen?.kind !== "cashout") break;
    s = act(s, { type: "toShop" });
    const idx = (s.shop ?? []).findIndex(
      (it) => it.kind === "joker" && (it.data.add ?? it.data.xm) && it.price <= s.money,
    );
    if (idx >= 0) {
      s = act(s, { type: "buy", index: idx });
      if (s.jokers.some((j) => j.add ?? j.xm)) return s;
    }
    s = act(s, { type: "nextBlind" });
    if (s.screen?.kind !== "blindselect") break;
  }
  throw new Error(`seed ${seed} never bought a scoring joker`);
}

/* From the shop: on to the next blind and through its first deal. */
function onward(state: GameState): { state: GameState; scores: number[] } {
  const scores: number[] = [];
  let s = playBlind(act(state, { type: "nextBlind" }), basicPolicy);
  while (s.screen?.kind === "dealend") {
    scores.push(s.screen.score);
    s = playToScreen(advance(gameReducer(s, { type: "nextDeal" })), basicPolicy);
  }
  if (s.screen?.kind === "cashout") scores.push(s.screen.score);
  return { state: s, scores };
}

describe("a resumed run plays on identically", () => {
  const saved = runWithJoker("SAVERUN");

  it("reached a shop with a scoring joker owned", () => {
    /* A vacuous round trip would prove nothing: the point is the effects. */
    expect(saved.screen?.kind).toBe("shop");
    expect(saved.jokers.some((j) => j.add ?? j.xm)).toBe(true);
  });

  it("comes back through JSON with the same jokers", () => {
    const back = rehydrate(roundTrip(saved), saved.bestAnte)!;
    expect(back.jokers).toEqual(saved.jokers);
    expect(back.jokers[0]).toBe(saved.jokers[0]);
  });

  it("advances to the same state and the same deal scores", () => {
    const back = rehydrate(roundTrip(saved), saved.bestAnte)!;
    const a = onward(saved);
    const b = onward(back);
    expect(b.scores).toEqual(a.scores);
    expect(b.scores.length).toBeGreaterThan(0);
    expect(b.state).toEqual(a.state);
  });
});

describe("the saved shape", () => {
  it("carries the version in the payload", () => {
    const snap: SavedRun = dehydrate(stocked());
    expect(snap.v).toBe(SAVE_VERSION);
  });
});
