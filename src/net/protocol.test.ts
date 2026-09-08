import { describe, expect, it } from "vitest";
import { SCOPE, encodeMsg, guestMay, hashState, parseMsg, scopeOf } from "./protocol";
import { advance } from "../game/drive";
import { gameReducer } from "../game/reducer";
import { createRun } from "../game/state";
import type { Action } from "../game/actions";
import type { GameState, Seat } from "../game/types";

/* A state in the middle of a deal, which is where every interesting field
   has a value. */
function midDeal(): GameState {
  return advance(gameReducer(createRun("NETPROTO"), { type: "startBlind" }));
}

describe("the scope table", () => {
  const of = (s: string) =>
    Object.entries(SCOPE)
      .filter(([, v]) => v === s)
      .map(([k]) => k)
      .sort();

  it("keeps the window's own actions off the wire", () => {
    expect(of("local")).toEqual(
      [
        "showMenu",
        "closeMenu",
        "openModal",
        "closeModal",
        "dismissToast",
        "clearPop",
        "setSortMode",
        "reorderHand",
        "moveCard",
      ].sort(),
    );
  });

  it("relays every action that carries a seat", () => {
    expect(of("seat")).toEqual(
      [
        "declare",
        "finishSwap",
        "pickSideCard",
        "acceptSooli",
        "declineSooli",
        "sooliGive",
        "startSooliPlay",
        "playCard",
        "layCards",
        "passLaydown",
        "buy",
        "reroll",
        "sellJoker",
        "sellSideCard",
        "useConsumable",
      ].sort(),
    );
  });

  it("relays the run's flow, which any human may click", () => {
    expect(of("flow")).toEqual(
      [
        "newRun",
        "startBlind",
        "skipBlind",
        "startChallenge",
        "leaveChallenge",
        "nextDeal",
        "toShop",
        "nextBlind",
      ].sort(),
    );
  });

  it("leaves the clock to the host", () => {
    expect(of("auto")).toEqual(
      [
        "aiDeclare",
        "finishDeclare",
        "aiPlay",
        "resolveTrick",
        "endTrick",
        "showHandResult",
        "aiLaydown",
      ].sort(),
    );
  });

  it("classifies every action exactly once", () => {
    /* The Record type is the real gate — a new action is a compile error
       until it is classified — but a scope typo would still pass that. */
    const scopes = new Set(Object.values(SCOPE));
    expect([...scopes].sort()).toEqual(["auto", "flow", "local", "seat"]);
    expect(Object.keys(SCOPE)).toHaveLength(
      of("local").length + of("seat").length + of("flow").length + of("auto").length,
    );
  });
});

describe("a local action", () => {
  /* The nine are local precisely because they touch nothing the hash reads:
     if one of them ever moves a hashed field, relaying it becomes mandatory
     and this test is what says so. */
  const g = midDeal();
  const uid = g.hands[0][0].uid;
  const LOCAL: Action[] = [
    { type: "showMenu", view: "start" },
    { type: "closeMenu" },
    { type: "openModal", modal: "rules" },
    { type: "closeModal" },
    { type: "dismissToast", id: 1 },
    { type: "clearPop" },
    { type: "setSortMode", p: 0, mode: "rank" },
    { type: "reorderHand", p: 0, uids: g.hands[0].map((c) => c.uid).reverse() },
    { type: "moveCard", p: 0, uid, dir: 1 },
  ];

  it.each(LOCAL.map((a) => [a.type, a] as const))("%s leaves the hash alone", (_t, a) => {
    expect(scopeOf(a)).toBe("local");
    expect(hashState(gameReducer(g, a))).toBe(hashState(g));
  });

  /* Without this the three hand actions above would pass by doing nothing:
     the hash ignores a hand's order, so the assertion is only worth
     something if the order actually moved. */
  it("really does reorder a hand", () => {
    const before = g.hands[0].map((c) => c.uid);
    const after = gameReducer(g, {
      type: "reorderHand",
      p: 0,
      uids: before.slice().reverse(),
    }).hands[0].map((c) => c.uid);
    expect(after).not.toEqual(before);
    expect(after.slice().sort()).toEqual(before.slice().sort());
  });
});

describe("the desync hash", () => {
  const g = midDeal();

  it("is the same for the same state", () => {
    expect(hashState(g)).toBe(hashState(midDeal()));
  });

  it("ignores the order of a hand", () => {
    const hands = g.hands.map((h) => h.slice().reverse()) as GameState["hands"];
    expect(hashState({ ...g, hands })).toBe(hashState(g));
  });

  it("does not ignore a card that moved seats", () => {
    const hands = g.hands.map((h) => h.slice()) as GameState["hands"];
    hands[1] = [...hands[1], hands[0][0]];
    hands[0] = hands[0].slice(1);
    expect(hashState({ ...g, hands })).not.toBe(hashState(g));
  });

  const MOVED: [string, Partial<GameState>][] = [
    ["seed", { seed: "OTHER" }],
    ["rngState", { rngState: g.rngState + 1 }],
    ["uidSeq", { uidSeq: g.uidSeq + 1 }],
    ["phase", { phase: "handend" }],
    ["turn", { turn: ((g.turn + 1) % 4) as Seat }],
    ["leader", { leader: ((g.leader + 1) % 4) as Seat }],
    ["trickNo", { trickNo: g.trickNo + 1 }],
    ["tricks", { tricks: [g.tricks[0] + 1, g.tricks[1]] }],
    ["dealsLeft", { dealsLeft: g.dealsLeft + 1 }],
    ["ante", { ante: g.ante + 1 }],
    ["blindIdx", { blindIdx: g.blindIdx + 1 }],
    ["mode", { mode: g.mode === "rami" ? "nolo" : "rami" }],
    ["declIdx", { declIdx: g.declIdx + 1 }],
    ["sooliSeat", { sooliSeat: 2 }],
  ];

  it.each(MOVED)("moves when %s does", (_name, over) => {
    expect(hashState({ ...g, ...over })).not.toBe(hashState(g));
  });

  it("moves when a wallet does", () => {
    const economies = g.economies.map((e) => ({ ...e })) as GameState["economies"];
    economies[2] = { ...economies[2], money: economies[2].money + 1 };
    expect(hashState({ ...g, economies })).not.toBe(hashState(g));
  });

  it("moves when the trick does", () => {
    const trick = [{ p: 0 as Seat, card: g.hands[0][0] }];
    expect(hashState({ ...g, trick })).not.toBe(hashState(g));
  });
});

describe("a message off the wire", () => {
  it("round-trips every kind", () => {
    const all = [
      { t: "hello", v: 1 },
      { t: "welcome", v: 1, seat: 2 },
      { t: "act", n: 7, a: { type: "endTrick" } },
      { t: "req", a: { type: "playCard", p: 1, uid: "u1" } },
      { t: "hash", n: 7, h: "deadbeef" },
      { t: "bye" },
    ] as const;
    for (const m of all) expect(parseMsg(encodeMsg(m))).toEqual(m);
  });

  it.each([
    ["not json at all", "{"],
    ["json that is not an object", "42"],
    ["an unknown kind", '{"t":"attack"}'],
    ["a known kind with the wrong fields", '{"t":"act","n":"seven","a":{"type":"endTrick"}}'],
    ["an action this build does not know", '{"t":"act","n":1,"a":{"type":"giveMeAllTheMoney"}}'],
    ["a seat that is not a seat", '{"t":"welcome","v":1,"seat":9}'],
  ])("refuses %s without throwing", (_why, text) => {
    expect(parseMsg(text)).toBeNull();
  });
});

describe("what a guest may send", () => {
  it("its own seat's decisions", () => {
    expect(guestMay({ type: "playCard", p: 1, uid: "u" }, 1)).toBe(true);
  });
  it("but not another seat's", () => {
    expect(guestMay({ type: "playCard", p: 2, uid: "u" }, 1)).toBe(false);
  });
  it("the run's flow", () => {
    expect(guestMay({ type: "nextDeal" }, 1)).toBe(true);
  });
  it("never the clock's, and never the window's own", () => {
    expect(guestMay({ type: "aiPlay" }, 1)).toBe(false);
    expect(guestMay({ type: "openModal", modal: "rules" }, 1)).toBe(false);
  });
});
