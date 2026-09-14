import { describe, expect, it } from "vitest";
import { BOSSES, CONSUMABLES, JOKERS, VOUCHERS } from "./content";
import { act, advance } from "./drive";
import { gameReducer } from "./reducer";
import { ownerSeat } from "./rules";
import { SAVE_VERSION, dehydrate, rehydrate, resumable, type SavedRun } from "./save";
import { cardOffer } from "./shop";
import { econOf } from "./economy";
import { createRun } from "./state";
import { basicPolicy, playBlind, playToScreen } from "../test/bot";
import { card, withEcon, withOver } from "../test/factories";
import type { GameState } from "./types";

/* Drives a fresh Tuppi-Rummikub game to one card into its laydown: enough for
   both `table` and at least one `layHands` side to hold real cards, which is
   what the round trip below and the corruption cases need. */
function midRummikub(seed: string): GameState {
  let s = advance(gameReducer(createRun(seed), { type: "startChallenge", id: "rummikub", seed }));
  const me = ownerSeat(s);
  while (s.phase === "play")
    s = act(s, { type: "playCard", p: me, uid: basicPolicy.chooseCard(s, me) });
  if (s.phase !== "laydown") throw new Error(`expected laydown, got ${s.phase}`);
  const combos = basicPolicy.laydown(s, me);
  s = act(s, combos ? { type: "layCards", p: me, combos } : { type: "passLaydown", p: me });
  return s;
}

/* A run with something in every field the snapshot has to translate: owned
   jokers with real effects, a consumable, a voucher, a boss and a full shop. */
function stocked(): GameState {
  const g = createRun("SAVETEST");
  return withOver(g, {
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
  });
}

/* The same run with a wallet at a seat nobody plays from. Seat 0 is the only
   wallet in use today, so a dehydrate that serialised it alone would look
   perfectly healthy — this is the fixture that catches it. */
function stockedTwoWallets(): GameState {
  return withEcon(stocked(), 1, {
    money: 31,
    jokers: [JOKERS[3]],
    sideDeck: [card("C", 5, "gold")],
  });
}

/* A dehydrated payload's wallets, as loose records: the rejection cases below
   edit one field of one wallet. */
const walletOf = (s: Record<string, unknown>, p = 0): Record<string, unknown> =>
  (s.economies as Record<string, unknown>[])[p];

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
    expect(snap.economies[0].jokers).toEqual([JOKERS[0].id, JOKERS[11].id]);
    expect(snap.economies[0].consumables).toEqual([CONSUMABLES[0].id]);
    expect(snap.boss).toBe(BOSSES[1].id);
    expect(snap.economies[0].shop).toEqual([
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

  /* The start menu is not part of the run: a reload opens on it because the
     boot path puts it there, never because a snapshot remembered it. */
  it("leaves the start menu out of the snapshot", () => {
    const snap = dehydrate({ ...stocked(), menu: "start" }) as Record<string, unknown>;
    expect(Object.keys(snap)).not.toContain("menu");
  });
});

describe("rehydrate", () => {
  it("gives back the very content objects, effects and all", () => {
    const back = rehydrate(roundTrip(stocked()), 0)!;
    expect(back).not.toBeNull();
    const e = econOf(back, 0);
    expect(e.jokers[0]).toBe(JOKERS[0]);
    expect(typeof e.jokers[0].add).toBe("function");
    expect(e.jokers[1]).toBe(JOKERS[11]);
    expect(typeof e.jokers[1].xm).toBe("function");
    expect(e.consumables[0]).toBe(CONSUMABLES[0]);
    expect(back.boss).toBe(BOSSES[1]);
  });

  /* Every boss goes through save.ts as its id alone, so a new row needs no
     migration and SAVE_VERSION stays put: a save written before the row cannot
     name an id that did not exist. */
  it.each(BOSSES.map((b) => [b.id, b] as const))("round trips the boss %s", (id, boss) => {
    const snap = dehydrate({ ...stocked(), boss });
    expect(snap.boss).toBe(id);
    expect(rehydrate(JSON.parse(JSON.stringify(snap)) as unknown, 0)!.boss).toBe(boss);
  });

  it("gives back an unsold shop joker as the JOKERS entry itself", () => {
    const back = rehydrate(roundTrip(stocked()), 0)!;
    const it = econOf(back, 0).shop![0];
    expect(it.kind).toBe("joker");
    if (it.kind !== "joker") return;
    expect(it.sold).toBe(false);
    expect(it.data).toBe(JOKERS[2]);
    expect(typeof it.data.add).toBe("function");
  });

  it("rebuilds a shop card offer from ENH rather than from the save", () => {
    const back = rehydrate(roundTrip(stocked()), 0)!;
    expect(econOf(back, 0).shop![1]).toEqual({
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
    expect(econOf(back, 0).money).toBe(17);
    expect(back.screen).toEqual({ kind: "shop" });
    expect(back.partyMap).toEqual(createRun("SAVETEST").partyMap);
    expect(back.modal).toBeNull();
    expect(back.toast).toBeNull();
    expect(back.toastSeq).toBe(0);
  });

  /* Every save written before the menu shipped is a real run, so a snapshot
     without the field resumes with Continue on offer. */
  it("offers a Continue for a save written before the field existed", () => {
    const snap = roundTrip(stocked()) as Record<string, unknown>;
    expect(snap.runStarted).toBe(false);
    delete snap.runStarted;
    expect(rehydrate(snap, 0)!.runStarted).toBe(true);
  });

  it("keeps a saved runStarted of its own", () => {
    expect(rehydrate(roundTrip({ ...stocked(), runStarted: true }), 0)!.runStarted).toBe(true);
    expect(rehydrate(roundTrip({ ...stocked(), runStarted: false }), 0)!.runStarted).toBe(false);
  });

  /* Every seat's wallet, not the owner's alone. A dehydrate that serialised
     economies[0] and left the rest at newEconomy() would pass every other case
     in this file: seat 0 is the only wallet a single-player run spends. */
  it("brings back a wallet belonging to a seat nobody plays from", () => {
    const back = rehydrate(roundTrip(stockedTwoWallets()), 0)!;
    const e = econOf(back, 1);
    expect(e.money).toBe(31);
    expect(e.jokers[0]).toBe(JOKERS[3]);
    expect(typeof e.jokers[0].p).toBe("number");
    expect(e.sideDeck.map((c) => [c.s, c.r, c.enh])).toEqual([["C", 5, "gold"]]);
    /* And the owner's is untouched by the other one arriving. */
    expect(econOf(back, 0).money).toBe(17);
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

  /* v1 is dropped outright, not chained through two upgrades: exactly one
     migration exists at a time. A v1 payload counted a pair's tricks in two
     flat fields instead of tricks[team]; those two names are deliberately not
     written out here — the invariant bans them from src/ entirely — and it is
     the version gate, not the missing field, that does the rejecting. */
  it("rejects a version 1 save outright", () => {
    const v1 = broken((s) => {
      s.v = 1;
      delete s.tricks;
    });
    expect(rehydrate(v1, 0)).toBeNull();
  });

  /* The version gate is the whole of it now: no migration exists, so 2 is
     refused beside every other version rather than claimed by an upgrade. */
  it.each([0, 1, 2, 4, 99])("still rejects a version %i save", (version) => {
    expect(
      rehydrate(
        broken((s) => void (s.v = version)),
        0,
      ),
    ).toBeNull();
  });

  /* The case above cannot see a reintroduced upgrade on its own: a v3 payload
     carries no flat economy fields, so an upgrade let loose on every version
     finds nothing to fold and falls back to the raw save, which the gate
     rejects anyway. This is the payload that exposes one — the seventeen
     economy fields flattened back to the top level, which is exactly where
     they lived under version 2 and exactly what a fold would look for. */
  it.each([0, 1, 2, 4, 99])("rejects a version %i save that carries a flat economy", (version) => {
    const flat = broken((s) => {
      Object.assign(s, walletOf(s));
      delete s.economies;
      s.v = version;
    });
    expect(rehydrate(flat, 0)).toBeNull();
  });

  /* econOf reads economies positionally, so a short array would leave a seat's
     wallet undefined rather than empty. */
  it.each([1, 3, 5])("rejects an economies array %i wallets long", (n) => {
    const raw = broken((s) => {
      const w = s.economies as unknown[];
      s.economies = Array.from({ length: n }, (_, i) => w[Math.min(i, w.length - 1)]);
    });
    expect(rehydrate(raw, 0)).toBeNull();
  });

  it.each([null, 42, "wallet"])("rejects a wallet that is %s", (bad) => {
    const raw = broken((s) => {
      (s.economies as unknown[])[1] = bad;
    });
    expect(rehydrate(raw, 0)).toBeNull();
  });

  it("rejects an unknown joker id", () => {
    expect(
      rehydrate(
        broken((s) => void (walletOf(s).jokers = ["ramikone", "eiolemassa"])),
        0,
      ),
    ).toBeNull();
  });

  it("rejects an unknown consumable id", () => {
    expect(
      rehydrate(
        broken((s) => void (walletOf(s).consumables = ["eiolemassa"])),
        0,
      ),
    ).toBeNull();
  });

  it("rejects an unknown voucher id", () => {
    expect(
      rehydrate(
        broken((s) => void (walletOf(s).vouchers = ["eiolemassa"])),
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
      (walletOf(s).shop as Record<string, unknown>[])[0].id = "eiolemassa";
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
      (walletOf(s).sideDeck as Record<string, unknown>[])[0].enh = "timantti";
    });
    expect(rehydrate(raw, 0)).toBeNull();
  });

  it("rejects an unknown enhancement on a shop card offer", () => {
    const raw = broken((s) => {
      (walletOf(s).shop as Record<string, unknown>[])[1].enh = "timantti";
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
    const idx = (econOf(s, 0).shop ?? []).findIndex(
      (it) => it.kind === "joker" && (it.data.add ?? it.data.xm) && it.price <= econOf(s, 0).money,
    );
    if (idx >= 0) {
      s = act(s, { type: "buy", p: 0, index: idx });
      if (econOf(s, 0).jokers.some((j) => j.add ?? j.xm)) return s;
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
    expect(econOf(saved, 0).jokers.some((j) => j.add ?? j.xm)).toBe(true);
  });

  it("comes back through JSON with the same jokers", () => {
    const back = rehydrate(roundTrip(saved), saved.bestAnte)!;
    expect(econOf(back, 0).jokers).toEqual(econOf(saved, 0).jokers);
    expect(econOf(back, 0).jokers[0]).toBe(econOf(saved, 0).jokers[0]);
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

  /* The seat-absolute fields ride along in the snapshot like every other, and
     come back the same. */
  it("round trips seats, tricks and sooliSeat", () => {
    const g: GameState = { ...stocked(), tricks: [8, 5], sooliSeat: 2 };
    const snap = dehydrate(g);
    expect(snap.seats).toEqual(["human", "ai", "ai", "ai"]);
    expect(snap.tricks).toEqual([8, 5]);
    expect(snap.sooliSeat).toBe(2);
    /* The two flat per-team counters tricks[team] replaced are gone for good.
       Matched by shape rather than by name, because the invariant bans both
       names from src/ — a top-level key ending in "Tricks" is one of them
       coming back. */
    expect(Object.keys(snap).filter((k) => /Tricks$/.test(k))).toEqual([]);

    const back = rehydrate(JSON.parse(JSON.stringify(snap)), 0);
    expect(back?.seats).toEqual(["human", "ai", "ai", "ai"]);
    expect(back?.tricks).toEqual([8, 5]);
    expect(back?.sooliSeat).toBe(2);
  });
});

describe("a parked run never reaches the snapshot", () => {
  /* `parked` is a snapshot itself. Left in, a save would nest one inside
     another and grow without bound, and a challenge — which is never saved —
     would drag the main run's whole state onto disk twice. */
  it("drops the parked field", () => {
    const inner = dehydrate(createRun("PARKED"));
    const g: GameState = { ...createRun("OUTER"), challenge: null, parked: inner };
    const snap = dehydrate(g);

    expect("parked" in snap).toBe(false);
    expect(JSON.stringify(snap)).not.toContain("parked");
    expect(JSON.stringify(snap)).not.toContain("PARKED");
  });

  it("brings the field back at its createRun value", () => {
    const g: GameState = { ...createRun("OUTER"), parked: dehydrate(createRun("PARKED")) };
    const back = rehydrate(JSON.parse(JSON.stringify(dehydrate(g))), 0);
    expect(back?.parked).toBeNull();
  });

  it("gives a missing layTurn/layNo/layPassed/layScores their createRun value", () => {
    /* rehydrate starts from createRun(seed), which is what lets a field added
       later ride along without a bump. That was the argument for the three
       deliberate non-bumps; it is not the argument for a *removed* field,
       which is why the seat-absolute change bumped to 2. These four are still
       read only for truthiness or shape elsewhere, so they still ride the
       four-non-bump argument. */
    const old = dehydrate(createRun("OLD")) as unknown as Record<string, unknown>;
    for (const k of ["layTurn", "layNo", "layPassed", "layScores"]) delete old[k];
    const back = rehydrate(old, 0);
    expect(back).not.toBeNull();
    expect(back?.layScores).toEqual([0, 0]);
  });

  /* challenge, table and layHands are the opposite case now that a challenge
     itself reaches disk: they are read positionally (a content id, a
     laydown row's cards, a pair of hands), so a save missing any of them is
     refused whole rather than given a silent createRun default — the same
     rule the economies array already had. This is what the fourth
     SAVE_VERSION non-bump comment means by "validated instead of bumped". */
  it.each(["challenge", "table", "layHands"])(
    "rejects a save missing %s entirely, rather than defaulting it",
    (k) => {
      const old = dehydrate(createRun("OLD")) as unknown as Record<string, unknown>;
      delete old[k];
      expect(rehydrate(old, 0)).toBeNull();
    },
  );
});

/* ==================== the challenge's own fields on disk ====================
   table, layHands and challenge were carried by dehydrate's rest-spread
   before a challenge could be saved, simply unread by rehydrate. Now that a
   challenge snapshot reaches disk for real, each is validated the same way
   the economies array already was: whole rejection on the first thing that
   does not fit, never a partial load. */
describe("the challenge's own fields on disk", () => {
  const brokenChallenge = (seed: string, edit: (s: Record<string, unknown>) => void): unknown => {
    const s = roundTrip(midRummikub(seed)) as Record<string, unknown>;
    edit(s);
    return s;
  };

  it("round-trips a mid-Rummikub state's table and both laydown hands", () => {
    const s = midRummikub("MIDLAY");
    /* Vacuity guard: a lay that placed nothing would prove the round trip
       works on empty arrays alone, which cardsOk already covered. */
    expect(s.table.length + s.layHands[0].length + s.layHands[1].length).toBeGreaterThan(0);

    const back = rehydrate(roundTrip(s), 0);
    expect(back).not.toBeNull();
    expect(back?.table).toEqual(s.table);
    expect(back?.layHands).toEqual(s.layHands);
    expect(back?.table.flatMap((row) => row.map((c) => c.uid))).toEqual(
      s.table.flatMap((row) => row.map((c) => c.uid)),
    );
    expect(back?.layHands.flatMap((h) => h.map((c) => c.uid))).toEqual(
      s.layHands.flatMap((h) => h.map((c) => c.uid)),
    );
    expect(back?.uidSeq).toBe(s.uidSeq);
  });

  it("rejects when table is not an array", () => {
    expect(
      rehydrate(
        brokenChallenge("BADTABLE1", (s) => void (s.table = "nope")),
        0,
      ),
    ).toBeNull();
  });

  it("rejects when a table card fails the strengthened cardOk", () => {
    expect(
      rehydrate(
        brokenChallenge("BADTABLE2", (s) => {
          const table = s.table as Record<string, unknown>[][];
          if (table.length === 0 || table[0].length === 0)
            throw new Error("fixture laid nothing onto the table");
          delete table[0][0].uid;
        }),
        0,
      ),
    ).toBeNull();
  });

  it("rejects when layHands is not an array of exactly two", () => {
    expect(
      rehydrate(
        brokenChallenge("BADLAY1", (s) => void (s.layHands = [[]])),
        0,
      ),
    ).toBeNull();
  });

  it("rejects when a layHands card fails cardOk", () => {
    expect(
      rehydrate(
        brokenChallenge("BADLAY2", (s) => {
          const hands = s.layHands as Record<string, unknown>[][];
          const side = hands[0].length > 0 ? 0 : 1;
          if (hands[side].length === 0)
            throw new Error("fixture has no cards in either laydown hand");
          hands[side][0].s = "X";
        }),
        0,
      ),
    ).toBeNull();
  });

  it("rejects when challenge is neither null nor a known id", () => {
    expect(
      rehydrate(
        brokenChallenge("BADID", (s) => void (s.challenge = "bogus")),
        0,
      ),
    ).toBeNull();
  });

  it("accepts challenge: null on a main-game snapshot", () => {
    expect(rehydrate(roundTrip(stocked()), 0)).not.toBeNull();
  });
});

/* ==================== the race's three fields ====================
   Added rather than moved or removed, so SAVE_VERSION stays 3: a v3 payload
   written before the race arrives at createRun's values, and nothing reads
   any of them outside a race. `raceScores` is read positionally, but an
   *added* positional field is not the widened-array case `beaten` was —
   [0, 0] is the right value for every older save. */
describe("the race's fields ride along in a main-game snapshot", () => {
  it("round-trips all three", () => {
    const g: GameState = {
      ...createRun("RACESAVE"),
      raceDeal: 6,
      raceBase: [1200, 0],
      raceScores: [9000, 4500],
    };
    const back = rehydrate(JSON.parse(JSON.stringify(dehydrate(g))), 0);
    expect(back?.raceDeal).toBe(6);
    expect(back?.raceBase).toEqual([1200, 0]);
    expect(back?.raceScores).toEqual([9000, 4500]);
  });

  it("gives a v3 payload written before them their createRun values", () => {
    const old = dehydrate(createRun("PRERACE")) as unknown as Record<string, unknown>;
    for (const k of ["raceDeal", "raceBase", "raceScores"]) delete old[k];
    const back = rehydrate(old, 0);
    expect(back).not.toBeNull();
    expect(back?.raceDeal).toBe(0);
    expect(back?.raceBase).toEqual([0, 0]);
    expect(back?.raceScores).toEqual([0, 0]);
  });
});

/* ==================== resuming a slot ====================
   rehydrate plus the two refusals a Continue button needs before it trusts
   what a slot holds: the payload has to be for the slot it was read from,
   and the board it names has to be soloBoard. Either refusal reads as no
   save at all, exactly like a payload rehydrate itself already refuses. */
describe("resumable", () => {
  it("accepts a save whose challenge matches the id it was read for", () => {
    const g = midRummikub("RESOK");
    expect(resumable(roundTrip(g), "rummikub", 0)).not.toBeNull();
  });

  it("refuses a slot's save for a different mode than the slot names", () => {
    const race = advance(
      gameReducer(createRun("RESRACE"), { type: "startChallenge", id: "race", seed: "RESRACE" }),
    );
    expect(resumable(roundTrip(race), "rummikub", 0)).toBeNull();
  });

  it("refuses the main run's own key when asked for a challenge id", () => {
    expect(resumable(roundTrip(stocked()), "rummikub", 0)).toBeNull();
  });

  it("accepts the main run's own key when asked with id null", () => {
    expect(resumable(roundTrip(stocked()), null, 0)).not.toBeNull();
  });

  it("refuses a board naming more than one human seat", () => {
    const two = withOver(stocked(), { seats: ["human", "human", "ai", "ai"] });
    expect(resumable(roundTrip(two), null, 0)).toBeNull();
  });

  it("refuses whatever rehydrate itself refuses", () => {
    expect(resumable(null, null, 0)).toBeNull();
    expect(resumable({ v: SAVE_VERSION + 1 }, null, 0)).toBeNull();
  });
});
