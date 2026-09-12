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
        /* The tenth, and the only one of them that moves the hash: the window
           that sends it hangs the session up in the same click. */
        "leaveChallenge",
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
        "aiSooli",
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
  /* Nine of the ten are local precisely because they touch nothing the hash
     reads: if one of them ever moves a hashed field, relaying it becomes
     mandatory and this test is what says so. The tenth is named below. */
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

  /* The exception, as a literal list of one: leaveChallenge is local because
     the window that sends it stops being a peer in the same click — the two
     result screens hang the session up — and not because it touches nothing
     shared. A second name here has to argue for itself rather than cite this
     one as a precedent. */
  const HASH_MOVERS: Array<Action["type"]> = ["leaveChallenge"];

  it("has exactly one exception, so a second is a failure rather than a precedent", () => {
    expect(HASH_MOVERS).toHaveLength(1);
  });

  /* And the two lists together are the whole scope, so a local action added
     later cannot slip past both of them. */
  it("accounts for every local action one way or the other", () => {
    const local = Object.entries(SCOPE)
      .filter(([, v]) => v === "local")
      .map(([k]) => k);
    expect([...LOCAL.map((a) => a.type), ...HASH_MOVERS].sort()).toEqual(local.sort());
  });

  it.each(HASH_MOVERS)("%s is local although the hash does move", (type) => {
    /* A race with the mid-deal run parked behind it, which is the state the
       button is actually drawn over. */
    const race = gameReducer(g, { type: "startChallenge", id: "race", seed: "LEAVERACE" });
    const a = { type } as Action;
    expect(scopeOf(a)).toBe("local");
    expect(hashState(gameReducer(race, a))).not.toBe(hashState(race));
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
    /* Who is human is the sharpest field of them all: nextTick returns null
       for a "human" seat, so a peer that thinks a chair is AI runs a step no
       other peer ever sends. */
    ["seats", { seats: ["human", "human", "ai", "ai"] }],
    ["challenge", { challenge: "race" }],
    ["raceDeal", { raceDeal: g.raceDeal + 1 }],
    ["raceScores", { raceScores: [1, 0] }],
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

/* A race is built from the action alone. A guest has its own parked run, its
   own best ante and possibly a half-played run behind the menu, and none of it
   may reach the race it is told to start — that is the whole of lockstep at
   the moment a mode begins. */
describe("a race a seat table started", () => {
  const TABLE: GameState["seats"] = ["human", "ai", "human", "ai"];
  const start = (prev: GameState) =>
    gameReducer(prev, { type: "startChallenge", id: "race", seed: "WIRERACE", seats: TABLE });

  /* parked and bestAnte are the two fields a peer is allowed to differ in, and
     they are named here rather than left to the hash: the hash ignores both,
     so an equality that only ran through it would prove less than it looks. */
  const shared = (g: GameState) => ({ ...g, parked: null, bestAnte: 0 });

  const fresh = start(createRun("PEERA"));
  const seatedElsewhere = start({
    ...createRun("PEERB", 7),
    seats: ["ai", "human", "ai", "ai"],
  });
  const midRun = start(midDeal());

  it("comes out the same whatever the peer's own state was", () => {
    expect(hashState(seatedElsewhere)).toBe(hashState(fresh));
    expect(hashState(midRun)).toBe(hashState(fresh));
    expect(shared(seatedElsewhere)).toEqual(shared(fresh));
    expect(shared(midRun)).toEqual(shared(fresh));
  });

  it("keeps the table it was given, and nothing of the one it replaced", () => {
    expect(fresh.seats).toEqual(TABLE);
    expect(seatedElsewhere.seats).toEqual(TABLE);
    expect(fresh.challenge).toBe("race");
  });

  /* Vacuity guard: the three prior states really were different. */
  it("starts from three states that do not agree", () => {
    expect(hashState(midDeal())).not.toBe(hashState(createRun("PEERA")));
    expect(hashState(createRun("PEERB"))).not.toBe(hashState(createRun("PEERA")));
  });
});

describe("a message off the wire", () => {
  it.each(["soolioffer", "sooligive", "sooliready"] as const)(
    "round-trips the AI %s tick",
    (phase) => {
      const a = { type: "aiSooli", p: 3, phase } as const;
      const msg = { t: "act", n: 8, a } as const;
      expect(parseMsg(encodeMsg(msg))).toEqual(msg);
      expect(scopeOf(a)).toBe("auto");
      for (const p of [null, 0, 1, 2, 3] as const) expect(guestMay(a, p)).toBe(false);
    },
  );

  it.each([
    { type: "aiSooli" },
    { type: "aiSooli", p: 0 },
    { type: "aiSooli", p: null, phase: "soolioffer" },
    { type: "aiSooli", p: 4, phase: "soolioffer" },
    { type: "aiSooli", p: 0, phase: "play" },
  ])("refuses a malformed AI stage: %j", (a) => {
    expect(parseMsg(JSON.stringify({ t: "act", n: 1, a }))).toBeNull();
    expect(parseMsg(JSON.stringify({ t: "req", a }))).toBeNull();
  });

  it("round-trips every kind", () => {
    const all = [
      { t: "hello", v: 1, as: "player", name: "Sirpa" },
      { t: "hello", v: 1, as: "table" },
      { t: "welcome", v: 1, seat: 2 },
      /* The shared table is welcomed with no chair at all. */
      { t: "welcome", v: 1, seat: null },
      { t: "welcome", v: 5, seat: null, id: "peer-1" },
      { t: "lobby", players: [{ id: "host", name: "Aino", seat: 0 }] },
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
    ["an empty lobby peer id", '{"t":"lobby","players":[{"id":"","name":"A","seat":0}]}'],
    ["an untrimmed lobby name", '{"t":"lobby","players":[{"id":"p","name":" A ","seat":0}]}'],
  ])("refuses %s without throwing", (_why, text) => {
    expect(parseMsg(text)).toBeNull();
  });

  /* Version 1 carried no role at all and meant a player every time. The host's
     version gate is what turns such a peer away; this function's job is only
     never to throw, and to read the old shape as what it meant. */
  it("reads a hello with no role as a player", () => {
    expect(parseMsg('{"t":"hello","v":1}')).toEqual({ t: "hello", v: 1, as: "player" });
  });

  it("reads an unknown role as a player rather than refusing the message", () => {
    expect(parseMsg('{"t":"hello","v":2,"as":"referee"}')).toEqual({
      t: "hello",
      v: 2,
      as: "player",
    });
  });

  it("normalizes a room player's temporary name", () => {
    expect(parseMsg('{"t":"hello","v":5,"as":"player","name":"  Aino  "}')).toEqual({
      t: "hello",
      v: 5,
      as: "player",
      name: "Aino",
    });
  });

  it.each([
    ["an empty player name", '{"t":"hello","v":5,"as":"player","name":"  "}'],
    [
      "an oversized player name",
      '{"t":"hello","v":5,"as":"player","name":"123456789012345678901"}',
    ],
    ["a non-string player name", '{"t":"hello","v":5,"as":"player","name":42}'],
    ["a named shared table", '{"t":"hello","v":5,"as":"table","name":"Wall"}'],
  ])("refuses %s", (_why, text) => {
    expect(parseMsg(text)).toBeNull();
  });

  it("accepts a welcome that names no chair", () => {
    expect(parseMsg('{"t":"welcome","v":2,"seat":null}')).toEqual({
      t: "welcome",
      v: 2,
      seat: null,
    });
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

/* One branch in one pure function is the whole of the read-only guarantee on
   the host's side, so the case walks every key of SCOPE rather than a chosen
   few: the flow actions are the ones that would slip through a null test
   written after the `scope === "flow"` line instead of before it. */
describe("what a peer with no chair may send", () => {
  const AT_LEAST: Record<string, number> = { flow: 7, seat: 15, local: 10, auto: 7 };

  it.each(Object.keys(SCOPE))("refuses %s", (type) => {
    /* A seat action carries a `p`, and a null-seated peer must be refused
       whatever it puts there. */
    const a = { type, p: 0, uid: "u", decl: "rami", modal: "rules" } as unknown as Action;
    expect(guestMay(a, null)).toBe(false);
  });

  /* Vacuity guard: the sweep above is only worth something if it covered
     every scope, the flow one included. */
  it("covered every scope, flow included", () => {
    for (const [scope, least] of Object.entries(AT_LEAST)) {
      expect(Object.values(SCOPE).filter((s) => s === scope).length).toBeGreaterThanOrEqual(least);
    }
  });
});
