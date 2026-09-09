/* The flow. Phases are data and the bot plays through them, so a whole deal
   can be tested without a browser and without a timer. */
import { describe, expect, it } from "vitest";
import { act, advance } from "./drive";
import { econOf } from "./economy";
import { gameReducer } from "./reducer";
import { dealPoints } from "./points";
import { dealScores } from "./race";
import { anySwapAvailable, legalCards, ownerSeat, ownerTeam, trickSize } from "./rules";
import { createRun, newEconomy } from "./state";
import { withEcon, withOver, type StateOver } from "../test/factories";
import { makeRng, seedHash } from "./rng";
import { rollCardOffer } from "./shop";
import { ANTES, HAND_SUITS, RACE_TARGET, TUPPI_TARGET, teamOf } from "./constants";
import { BIG_BOSSES, CONSUMABLES, JOKERS, PARTY_IDS, SMALL_BOSSES, VOUCHERS } from "./content";
import { chooseLaydown } from "./ai";
import { comboOk } from "./laydown";
import { nextTick, waitingSeat } from "./schedule";
import { basicPolicy, playBlind, playChallenge, playRun, playToScreen } from "../test/bot";
import { card as C } from "../test/factories";
import type { Action } from "./actions";
import type { GameState, Mode, PlayerEconomy, Seat, ShopItem, Suit } from "./types";

const start = (seed = "FLOW") => gameReducer(createRun(seed), { type: "startBlind" });

describe("a deal runs to a result", () => {
  it("deals thirteen cards to each seat", () => {
    const g = start();
    expect(g.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(g.phase).toBe("declare");
  });

  it("reaches a screen and plays all thirteen tricks", () => {
    const g = playBlind(createRun("FLOW"));
    expect(g.screen).not.toBeNull();
    expect(["dealend", "cashout", "gameover"]).toContain(g.screen?.kind);
    expect(g.tricks[0] + g.tricks[1]).toBe(13);
    expect(g.hands[0]).toHaveLength(0);
  });

  it("stops ticking once the result is on screen", () => {
    const g = playBlind(createRun("FLOW"));
    expect(nextTick(g)).toBeNull();
  });
});

describe("the declaration round", () => {
  it("plays rami if anyone shows rami, and seats the leader to the declarer's right", () => {
    let g = start("DECL");
    /* The player declares rami, so rami is certain to be played. */
    while (g.phase === "declare") {
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", p: 0, decl: "rami" }) : advance(g);
    }
    expect(g.mode).toBe("rami");
    expect(g.ramSeat).not.toBeNull();
    expect(g.leader).toBe(((g.ramSeat ?? 0) + 3) % 4);
  });

  it("plays nolo when nobody shows rami", () => {
    let g = start("DECL");
    /* Weaken every hand, so the AI declares nolo. */
    const weak = g.hands.map((h) => h.map((c) => ({ ...c, r: 2 }))) as GameState["hands"];
    g = { ...g, hands: weak };
    while (g.phase === "declare") {
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", p: 0, decl: "nolo" }) : advance(g);
    }
    expect(g.mode).toBe("nolo");
    expect(g.ramSeat).toBeNull();
    expect(g.leader).toBe((g.dealer + 1) % 4);
  });

  it("forces rami under the Pakkorami boss", () => {
    let g = start("DECL");
    g = { ...g, boss: { id: "pakkorami", key: "boss.pakkorami" } };
    while (g.declSeq[g.declIdx] !== 0) g = advance(gameReducer(g, { type: "aiDeclare" }));
    g = gameReducer(g, { type: "declare", p: 0, decl: "nolo" });
    expect(g.shows[0]?.decl).toBe("rami");
  });

  it("forces nolo under the Pakkonolo boss", () => {
    let g = start("DECL");
    g = { ...g, boss: { id: "pakkonolo", key: "boss.pakkonolo" } };
    while (g.declSeq[g.declIdx] !== 0) g = advance(gameReducer(g, { type: "aiDeclare" }));
    g = gameReducer(g, { type: "declare", p: 0, decl: "rami" });
    expect(g.shows[0]?.decl).toBe("nolo");
  });

  /* Pakkonolo binds the player only: an opponent taking rami is what
     makes the blind playable at all. Every hand is aces, so handPower puts
     every AI seat over the rami threshold. */
  it("leaves the opponents free to show rami under Pakkonolo", () => {
    let g = start("DECL");
    const strong = g.hands.map((h) => h.map((c) => ({ ...c, r: 14 }))) as GameState["hands"];
    g = { ...g, hands: strong, boss: { id: "pakkonolo", key: "boss.pakkonolo" } };
    while (g.phase === "declare") {
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", p: 0, decl: "rami" }) : advance(g);
    }
    expect(g.shows[0]?.decl).toBe("nolo");
    expect([1, 2, 3].map((p) => g.shows[p as Seat]?.decl)).toEqual(["rami", "rami", "rami"]);
    expect(g.mode).toBe("rami");
  });
});

describe("maantuntopakko is enforced by the reducer", () => {
  it("refuses an illegal card and says why", () => {
    let g = start("LEGAL");
    g = {
      ...g,
      phase: "play",
      turn: 0,
      mode: "rami",
      trick: [{ p: 1, card: C("H", 13) }],
      hands: [[C("H", 5), C("C", 9)], [], [], []],
    };
    const after = gameReducer(g, { type: "playCard", p: 0, uid: "does-not-matter" });
    expect(after.trick).toHaveLength(1);

    const illegal = gameReducer(g, { type: "playCard", p: 0, uid: g.hands[0][1].uid });
    expect(illegal.trick).toHaveLength(1);
    expect(illegal.toast?.key).toBe("toast.mustFollow");
    expect(illegal.toast?.suit).toBe("H");

    const legal = gameReducer(g, { type: "playCard", p: 0, uid: g.hands[0][0].uid });
    expect(legal.trick).toHaveLength(2);
  });

  it("ignores a card played out of turn", () => {
    let g = start("LEGAL");
    g = { ...g, phase: "play", turn: 1 };
    const uid = g.hands[0][0].uid;
    expect(gameReducer(g, { type: "playCard", p: 0, uid }).trick).toHaveLength(0);
  });
});

describe("the tuppipakka swap needs the same card", () => {
  /* Suit and rank have to agree, so the side deck upgrades a card that was
     dealt to you rather than changing which cards you hold. */
  const swapState = (over: StateOver = {}): GameState => {
    const g = start("SWAP");
    return withOver(g, {
      phase: "swap",
      hands: [[C("S", 14), C("H", 7), C("D", 3)], [], [], []],
      sideDeck: [C("S", 14, "steel"), C("C", 12, "mult")],
      swaps: 2,
      swapsLeft: 2,
      usedSide: [],
      ...over,
    });
  };

  it("swaps the twin and keeps the enhancement in one pick", () => {
    const g = swapState();
    const done = gameReducer(g, { type: "pickSideCard", p: 0, uid: econOf(g, 0).sideDeck[0].uid });
    const twin = done.hands[0].find((c) => c.s === "S" && c.r === 14);
    expect(twin?.enh).toBe("steel");
    expect(twin?.srcUid).toBe(econOf(g, 0).sideDeck[0].uid);
    expect(done.hands[0]).toHaveLength(3);
    expect(econOf(done, 0).swapsLeft).toBe(1);
  });

  it("leaves every other hand card alone: only the twin changes", () => {
    const g = swapState();
    const done = gameReducer(g, { type: "pickSideCard", p: 0, uid: econOf(g, 0).sideDeck[0].uid });

    /* The 7H would be the natural card to dump, which is exactly what the
       rule forbids — the swap never reaches it. */
    const rest = done.hands[0].filter((c) => c.s !== "S" || c.r !== 14);
    expect(rest.map((c) => `${c.s}${c.r}`).sort()).toEqual(["D3", "H7"]);
    expect(rest.every((c) => c.enh === null && !c.srcUid)).toBe(true);
  });

  it("refuses a side-deck card whose twin was not dealt", () => {
    const g = swapState();
    /* The QC is in nobody's hand here. */
    const picked = gameReducer(g, {
      type: "pickSideCard",
      p: 0,
      uid: econOf(g, 0).sideDeck[1].uid,
    });
    expect(picked.toast?.key).toBe("toast.swapNoMatch");
    expect(econOf(picked, 0).swapsLeft).toBe(2);
    expect(econOf(picked, 0).usedSide).toEqual([]);
  });

  /* The swap panel disables its confirm button once the swaps are spent, and
     the bot checks swapsLeft before dispatching, so nothing in the project can
     reach this guard any more. The rule still lives in the reducer, so it is
     tested where it lives. */
  it("refuses a swap once the deal's swaps are spent", () => {
    const g = swapState({ swapsLeft: 0 });
    const picked = gameReducer(g, {
      type: "pickSideCard",
      p: 0,
      uid: econOf(g, 0).sideDeck[0].uid,
    });
    expect(picked.toast?.key).toBe("toast.noSwapsLeft");
    expect(econOf(picked, 0).usedSide).toEqual([]);
    expect(picked.hands[0]).toEqual(g.hands[0]);
  });

  it("does not offer a second swap for a card already swapped in", () => {
    const g = swapState({ sideDeck: [C("S", 14, "steel"), C("S", 14, "glass")] });
    const after = gameReducer(g, { type: "pickSideCard", p: 0, uid: econOf(g, 0).sideDeck[0].uid });
    expect(econOf(after, 0).swapsLeft).toBe(1);

    /* The steel card is in hand now; the glass card must not trade it away. */
    const again = gameReducer(after, {
      type: "pickSideCard",
      p: 0,
      uid: econOf(g, 0).sideDeck[1].uid,
    });
    expect(again.toast?.key).toBe("toast.swapNoMatch");
    expect(econOf(again, 0).swapsLeft).toBe(1);
    expect(after.hands[0].find((c) => c.s === "S" && c.r === 14)?.enh).toBe("steel");
  });

  it("skips the swap phase when the side deck matches nothing in hand", () => {
    let g = createRun("SKIPSWAP");
    g = withOver(g, { sideDeck: [C("S", 14, "steel")] });
    g = gameReducer(g, { type: "startBlind" });
    /* The AS went to exactly one of the four hands. */
    const mine = g.hands[0].some((c) => c.s === "S" && c.r === 14);
    expect(g.phase).toBe(mine ? "swap" : "declare");
  });
});

/* Sooli is offered only when the other side is the one playing rami. Shared
   with the seat-guard tests below, which need the same phase. */
const soolioffer = (): GameState => {
  for (const seed of ["SOOLI", "SOOLI2", "SOOLI3", "SOOLI4", "SOOLI5", "SOOLI6"]) {
    let g = start(seed);
    while (g.phase === "declare") {
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", p: 0, decl: "nolo" }) : advance(g);
    }
    if (g.phase === "soolioffer") return g;
  }
  throw new Error("no seed produced a sooli offer");
};

describe("sooli", () => {
  const toOffer = soolioffer;

  it("sits the partner out and shrinks the trick to three", () => {
    let g = toOffer();
    g = gameReducer(g, { type: "acceptSooli", p: 0 });
    expect(g.sooli).toBe(true);
    expect(g.phase).toBe("sooligive");

    const give = g.hands[0][0].uid;
    g = gameReducer(g, { type: "sooliGive", p: 0, uid: give });
    expect(g.phase).toBe("sooliready");
    expect(g.hands[2]).toHaveLength(0);
    expect(g.hands[0]).toHaveLength(13);
    expect(g.sooliExchange?.gave.uid).toBe(give);
    expect(trickSize(g)).toBe(3);
    /* The sooli player always plays last. */
    expect(g.sooliOrder?.[2]).toBe(0);
  });

  it("can be declined, and then plays as a normal ryosto", () => {
    const g = gameReducer(toOffer(), { type: "declineSooli", p: 0 });
    expect(g.sooli).toBe(false);
    expect(g.phase).toBe("play");
    expect(g.ramTeam).toBe(1);
  });

  it("records the seat the offer went to", () => {
    expect(toOffer().sooliSeat).toBe(0);
  });

  /* The sooli player is a seat, not the literal 0. Seated at 1, the partner
     that sits out is 3 and the trailing seat of sooliOrder is 1 — with the
     sit-out hardcoded to hands[2] the wrong partner would be emptied and
     thirteen cards would be unaccounted for. */
  it("sits the right partner out with the sooli at seat 1", () => {
    const offer = toOffer();
    const at1: GameState = {
      ...offer,
      seats: ["ai", "human", "ai", "ai"],
      /* The declaration was team 1's under this seeding; a sooli at seat 1
         needs the rami on the other side. */
      ramSeat: 0,
      ramTeam: 0,
      sooliSeat: 1,
    };
    let g = gameReducer(at1, { type: "acceptSooli", p: 1 });
    expect(g.sooli).toBe(true);
    const give = g.hands[1][0].uid;
    g = gameReducer(g, { type: "sooliGive", p: 1, uid: give });

    expect(g.hands[3]).toHaveLength(0);
    expect(g.hands[2]).toHaveLength(13);
    expect(g.hands[1]).toHaveLength(13);
    expect(g.sooliOrder).toEqual([0, 2, 1]);
    expect(g.sooliOrder?.[2]).toBe(1);
    expect(g.leader).toBe(0);
  });

  /* Every seat's cards are still on the table: the sit-out is one hand, not
     one plus a stray. */
  it("leaves exactly one hand empty whichever seat plays the sooli", () => {
    const offer = toOffer();
    for (const [seat, ram, ramTeam] of [
      [0, 1, 1],
      [1, 0, 0],
      [2, 1, 1],
      [3, 0, 0],
    ] as Array<[Seat, Seat, 0 | 1]>) {
      const seats: GameState["seats"] = ["ai", "ai", "ai", "ai"];
      seats[seat] = "human";
      const base: GameState = { ...offer, seats, sooliSeat: seat, ramSeat: ram, ramTeam };
      let g = gameReducer(base, { type: "acceptSooli", p: seat });
      g = gameReducer(g, { type: "sooliGive", p: seat, uid: g.hands[seat][0].uid });
      expect(g.hands.map((h) => h.length).filter((n) => n === 0)).toHaveLength(1);
      expect(g.hands.reduce((a, h) => a + h.length, 0)).toBe(39);
      expect(g.sooliOrder?.[2]).toBe(seat);
    }
  });
});

/* ==================== the seat guards ====================
   Every player action names the seat it acts for, and the reducer refuses one
   the state does not mark "human". Without the guard a dispatch naming an
   opponent would show their card, spend their swap or lay their hand. */
describe("an action for a seat that is not human", () => {
  const unchanged = (before: GameState, after: GameState) => expect(after).toEqual(before);

  const swapReady = (): GameState =>
    withOver(start("SWAPGUARD"), {
      phase: "swap",
      hands: [[C("S", 14), C("H", 7), C("D", 3)], [], [], []],
      sideDeck: [C("S", 14, "steel")],
      swaps: 2,
      swapsLeft: 2,
      usedSide: [],
    });

  const laydownReady = (): GameState => ({
    ...createRun("LAYGUARD"),
    challenge: "rummikub",
    mode: "rami",
    phase: "laydown",
    screen: null,
    tricks: [7, 6],
    layTurn: 0,
    layHands: [
      [C("S", 9), C("H", 9), C("C", 9), C("D", 4)],
      [C("S", 5), C("H", 5), C("C", 5), C("D", 2)],
    ],
  });

  it("refuses a declare for an opponent's seat", () => {
    const g = start("GUARD");
    expect(g.phase).toBe("declare");
    /* Seats 1 and 3 are "ai" in the default seating. */
    unchanged(g, gameReducer(g, { type: "declare", p: 1, decl: "rami" }));
    unchanged(g, gameReducer(g, { type: "declare", p: 3, decl: "nolo" }));
    /* the human seat's own declare does move the state */
    expect(gameReducer(g, { type: "declare", p: 0, decl: "rami" }).shows[0]).not.toBeNull();
  });

  it("refuses a pickSideCard for an opponent's seat", () => {
    const g = swapReady();
    const uid = econOf(g, 0).sideDeck[0].uid;
    unchanged(g, gameReducer(g, { type: "pickSideCard", p: 2, uid }));
    unchanged(g, gameReducer(g, { type: "pickSideCard", p: 1, uid }));
    expect(econOf(gameReducer(g, { type: "pickSideCard", p: 0, uid }), 0).swapsLeft).toBe(1);
  });

  it("refuses a sooliGive for an opponent's seat", () => {
    const g = gameReducer(soolioffer(), { type: "acceptSooli", p: 0 });
    expect(g.phase).toBe("sooligive");
    unchanged(g, gameReducer(g, { type: "sooliGive", p: 2, uid: g.hands[2][0].uid }));
    unchanged(g, gameReducer(g, { type: "sooliGive", p: 1, uid: g.hands[1][0].uid }));
    expect(gameReducer(g, { type: "sooliGive", p: 0, uid: g.hands[0][0].uid }).phase).toBe(
      "sooliready",
    );
  });

  it("refuses an acceptSooli and a startSooliPlay for an opponent's seat", () => {
    const g = soolioffer();
    unchanged(g, gameReducer(g, { type: "acceptSooli", p: 1 }));
    unchanged(g, gameReducer(g, { type: "declineSooli", p: 2 }));
    const ready = gameReducer(gameReducer(g, { type: "acceptSooli", p: 0 }), {
      type: "sooliGive",
      p: 0,
      uid: g.hands[0][0].uid,
    });
    unchanged(ready, gameReducer(ready, { type: "startSooliPlay", p: 3 }));
  });

  it("refuses a layCards and a passLaydown for an opponent's seat", () => {
    const g = laydownReady();
    const set = g.layHands[0].slice(0, 3).map((c) => c.uid);
    unchanged(g, gameReducer(g, { type: "layCards", p: 1, combos: [set] }));
    unchanged(g, gameReducer(g, { type: "passLaydown", p: 3 }));
    expect(gameReducer(g, { type: "layCards", p: 0, combos: [set] }).layTurn).toBe(1);
  });

  it("refuses a hand reorder for an opponent's seat", () => {
    const g = start("ORDERGUARD");
    const theirs = g.hands[1].map((c) => c.uid).reverse();
    unchanged(g, gameReducer(g, { type: "reorderHand", p: 1, uids: theirs }));
    unchanged(g, gameReducer(g, { type: "moveCard", p: 2, uid: g.hands[2][0].uid, dir: 1 }));
    unchanged(g, gameReducer(g, { type: "setSortMode", p: 3, mode: "rank" }));
  });

  /* The five economy actions are guarded like every other seat-carrying one,
     and silently: seat 1 is an AI, so a dispatch naming it is a bug in the
     sender rather than something to tell the player about. The guard sits
     ahead of every toast, temppukielto's included. */
  it("refuses every economy action for an opponent's seat", () => {
    /* The opponent's wallet is stocked too, so the seat guard is the only
       thing in the way: against an empty wallet every one of the five would
       return on its own and the guard would be untested. */
    const stock: Partial<PlayerEconomy> = {
      money: 50,
      jokers: [JOKERS[1]],
      consumables: [CONSUMABLES[0]],
      sideDeck: [C("S", 14, "steel")],
      shop: [{ kind: "joker", data: JOKERS[0], price: 5, sold: false }],
    };
    const g = withEcon(
      withOver(createRun("ECONGUARD"), { phase: "play", screen: null, ...stock }),
      1,
      stock,
    );
    expect(g.seats[1]).toBe("ai");
    /* And each of the five does move seat 0's own wallet, so the refusals
       below are the guard's doing and not a fixture nothing can act on. */
    for (const action of [
      { type: "buy", p: 0, index: 0 },
      { type: "reroll", p: 0 },
      { type: "sellJoker", p: 0, index: 0 },
      { type: "sellSideCard", p: 0, index: 0 },
      { type: "useConsumable", p: 0, index: 0 },
    ] as Action[])
      expect(econOf(gameReducer(g, action), 0), `${action.type} did nothing`).not.toEqual(
        econOf(g, 0),
      );
    for (const action of [
      { type: "buy", p: 1, index: 0 },
      { type: "reroll", p: 1 },
      { type: "sellJoker", p: 1, index: 0 },
      { type: "sellSideCard", p: 1, index: 0 },
      { type: "useConsumable", p: 1, index: 0 },
    ] as Action[]) {
      const after = gameReducer(g, action);
      unchanged(g, after);
      expect(after.toast, `${action.type} toasted`).toBeNull();
    }
  });

  /* Under the trick ban the toast comes first for a human — the boss shuts the
     tricks, and the player is told which. For an AI seat there is nobody to
     tell, so the seat guard has to stay ahead of it. */
  it("says nothing about the trick ban to an opponent's seat", () => {
    const ban = BIG_BOSSES.find((b) => b.id === "temppukielto")!;
    /* The opponent holds the same trick, so the seat guard is what silences
       the boss's toast rather than an empty box. */
    const g = withEcon(
      withOver(start("BANGUARD"), { phase: "play", boss: ban, consumables: [CONSUMABLES[0]] }),
      1,
      { consumables: [CONSUMABLES[0]] },
    );
    expect(gameReducer(g, { type: "useConsumable", p: 0, index: 0 }).toast?.key).toBe(
      "toast.tricksBanned",
    );
    unchanged(g, gameReducer(g, { type: "useConsumable", p: 1, index: 0 }));
  });

  /* One wallet moves, and only one. A reducer that wrote to economies[0]
     regardless of action.p would pass every assertion in this file that only
     ever shops from seat 0 — hence the second half, which shops from a human
     seated at 1 and watches seat 0's purse. */
  const shelf = (seat: Seat, over: Partial<GameState> = {}): GameState =>
    withEcon(
      {
        ...createRun("ECONWALLET"),
        phase: "shop",
        screen: { kind: "shop" },
        ...over,
      },
      seat,
      { money: 50, shop: [{ kind: "joker", data: JOKERS[0], price: 5, sold: false }] },
    );

  it("charges the acting seat's wallet and leaves the other three alone", () => {
    const g = shelf(0);
    const after = gameReducer(g, { type: "buy", p: 0, index: 0 });
    expect(econOf(after, 0).money).toBe(45);
    expect(econOf(after, 0).jokers).toEqual([JOKERS[0]]);
    for (const p of [1, 2, 3] as const) expect(econOf(after, p)).toEqual(newEconomy());
  });

  it("charges the wallet of a human seated anywhere but 0", () => {
    const g = shelf(1, { seats: ["ai", "human", "ai", "ai"] });
    const after = gameReducer(g, { type: "buy", p: 1, index: 0 });
    expect(econOf(after, 1).money).toBe(45);
    expect(econOf(after, 1).jokers).toEqual([JOKERS[0]]);
    for (const p of [0, 2, 3] as const) expect(econOf(after, p)).toEqual(newEconomy());
  });
});

/* ==================== the clock reads `seats`, not seat 0 ====================
   nextTick plays a seat marked "ai" and waits for one marked "human". Reverted
   to a `=== 0` test, the clock would play the human's own cards from any seat
   but 0 and never move at all from seat 0's opponents. */
describe("the clock's gates", () => {
  const humanAt = (g: GameState, p: 0 | 1 | 2 | 3): GameState => {
    const seats: GameState["seats"] = ["ai", "ai", "ai", "ai"];
    seats[p] = "human";
    return { ...g, seats };
  };

  it("waits for a human declaration and plays an ai one, at any seat", () => {
    const g = start("TICKDECL");
    expect(g.phase).toBe("declare");
    const p = g.declSeq[g.declIdx];
    expect(nextTick(humanAt(g, p))).toBeNull();
    expect(nextTick(humanAt(g, ((p + 1) % 4) as 0 | 1 | 2 | 3))?.action.type).toBe("aiDeclare");
  });

  it("waits for a human turn and plays an ai one, at any seat", () => {
    const base = { ...start("TICKPLAY"), phase: "play" as const, turn: 2 as const, screen: null };
    expect(nextTick(humanAt(base, 2))).toBeNull();
    expect(nextTick(humanAt(base, 0))?.action.type).toBe("aiPlay");
    expect(nextTick(humanAt(base, 1))?.action.type).toBe("aiPlay");
  });

  it("waits for a laydown turn either seat of whose team is human", () => {
    const base: GameState = {
      ...createRun("TICKLAY"),
      challenge: "rummikub",
      phase: "laydown",
      screen: null,
      layTurn: 1,
    };
    /* Team 1 is seats 1 and 3: a human in either of them owns the turn. */
    expect(nextTick(humanAt(base, 1))).toBeNull();
    expect(nextTick(humanAt(base, 3))).toBeNull();
    expect(nextTick(humanAt(base, 0))?.action.type).toBe("aiLaydown");
    expect(nextTick(humanAt(base, 2))?.action.type).toBe("aiLaydown");
  });
});

describe("cash-out", () => {
  /* The reward is worked out in the state transition, so a redraw cannot pay
     it twice. */
  it("awards the reward exactly once", () => {
    let g = createRun("CASH");
    g = {
      ...g,
      screen: null,
      blindScore: 99999,
      target: 1,
      phase: "handend",
      handScore: 500,
      dealsLeft: 2,
    };
    const once = gameReducer(g, { type: "showHandResult" });
    expect(once.screen?.kind).toBe("cashout");
    const money = econOf(once, 0).money;
    /* The same action again does nothing, because the step is already done. */
    const again = gameReducer(once, { type: "showHandResult" });
    expect(econOf(again, 0).money).toBe(money);
    expect(money).toBeGreaterThan(econOf(g, 0).money);
  });

  it("banks the blind score into the run total exactly once", () => {
    const g: GameState = {
      ...createRun("CASH"),
      screen: null,
      blindScore: 4200,
      target: 1,
      phase: "handend",
      handScore: 500,
      dealsLeft: 2,
    };
    const once = gameReducer(g, { type: "showHandResult" });
    expect(once.runScore).toBe(4200);
    /* The same action again opens no second cash-out, so it banks nothing. */
    expect(gameReducer(once, { type: "showHandResult" }).runScore).toBe(4200);
  });

  it("reports the breakdown that the screen shows", () => {
    let g = createRun("CASH");
    g = withOver(g, {
      screen: null,
      blindScore: 99999,
      target: 1,
      phase: "handend",
      handScore: 500,
      dealsLeft: 2,
      money: 20,
    });
    const s = gameReducer(g, { type: "showHandResult" }).screen;
    if (s?.kind !== "cashout") throw new Error("expected a cash-out screen");
    expect(s.reward + s.bonus + s.interest + s.spare).toBe(s.bank - 20);
  });
});

describe("the shop", () => {
  const openShop = (seed = "SHOP") =>
    gameReducer(withOver(createRun(seed), { money: 50 }), { type: "toShop" });

  it("charges for a purchase and marks the item sold", () => {
    const g = openShop();
    const item = (econOf(g, 0).shop ?? [])[0];
    const after = gameReducer(g, { type: "buy", p: 0, index: 0 });
    expect(econOf(after, 0).money).toBe(econOf(g, 0).money - item.price);
    expect(econOf(after, 0).shop?.[0].sold).toBe(true);
  });

  it("refuses a purchase you cannot afford", () => {
    const g = withOver(openShop(), { money: 0 });
    const after = gameReducer(g, { type: "buy", p: 0, index: 0 });
    expect(econOf(after, 0).money).toBe(0);
    expect(econOf(after, 0).shop?.[0].sold).toBe(false);
  });

  it("raises the reroll cost by two each time", () => {
    let g = openShop();
    const first = econOf(g, 0).rerollCost;
    g = gameReducer(g, { type: "reroll", p: 0 });
    expect(econOf(g, 0).rerollCost).toBe(first + 2);
    g = gameReducer(g, { type: "reroll", p: 0 });
    expect(econOf(g, 0).rerollCost).toBe(first + 4);
  });

  /* Every card offer names a card, stone included: under the same-card swap
     rule the suit and rank are which card it upgrades, so a stone offer fixed
     at 2S would make a second stone card unusable. */
  it("gives every card offer a suit, a rank and a label", () => {
    const rng = makeRng(seedHash("OFFERS"));
    const offers = Array.from({ length: 300 }, () => rollCardOffer(rng));
    for (const o of offers) {
      expect(o.card.s).toMatch(/^[SHDC]$/);
      expect(o.card.r).toBeGreaterThanOrEqual(2);
      expect(o.card.r).toBeLessThanOrEqual(14);
      expect(o.cardLabel).toBeTruthy();
    }
    const stones = offers.filter((o) => o.card.enh === "stone");
    expect(stones.length).toBeGreaterThan(0);
    expect(new Set(stones.map((o) => o.card.s + o.card.r)).size).toBeGreaterThan(1);
  });

  /* One voucher shop per ante, which is now the shop after the big boss and no
     other. A `>= 2` guard would offer vouchers twice an ante against a table of
     six, and an `=== 2` one would move them to the small boss. */
  it("stocks vouchers only in the shop that follows the big boss", () => {
    const shopsAt = (blindIdx: number) =>
      Array.from({ length: 20 }, (_, i) =>
        gameReducer(withOver(createRun(`VOUCHER${i}`), { money: 50, blindIdx }), {
          type: "toShop",
        }),
      );
    const flags = [0, 1, 2, 3].map((i) => shopsAt(i).every((g) => econOf(g, 0).shopAfterBoss));
    expect(flags).toEqual([false, false, false, true]);
    const anyVoucher = (blindIdx: number) =>
      shopsAt(blindIdx).some((g) => (econOf(g, 0).shop ?? []).some((it) => it.kind === "voucher"));
    expect([0, 1, 2].map(anyVoucher)).toEqual([false, false, false]);
    expect(anyVoucher(3)).toBe(true);
  });

  /* Buying into a full inventory. `replace` is an index into that inventory,
     and every case below names a non-zero one on purpose: a hard-coded
     splice(0, 1) would pass a test that only ever replaced the first item. */
  const shopWith = (item: ShopItem, over: StateOver = {}): GameState =>
    withOver(createRun("REPLACE"), {
      money: 50,
      phase: "shop",
      screen: { kind: "shop" },
      shop: [item],
      /* Past anything the shared card factory has minted, so a bought card can
       never be handed a uid a fixture card already holds. */
      uidSeq: 5000,
      ...over,
    });
  const jokerOffer: ShopItem = { kind: "joker", data: JOKERS[0], price: 5, sold: false };
  const consOffer: ShopItem = { kind: "consumable", data: CONSUMABLES[0], price: 4, sold: false };
  const cardOffer: ShopItem = {
    kind: "card",
    data: {
      id: "card-goldH7",
      key: "enh.gold",
      g: "$",
      p: 5,
      cardLabel: "7H",
      card: { s: "H", r: 7, enh: "gold" },
    },
    price: 5,
    sold: false,
  };
  const fullJokers = () =>
    shopWith(jokerOffer, {
      jokers: [JOKERS[1], JOKERS[2], JOKERS[3], JOKERS[4]],
      jokerSlots: 4,
    });
  const fullSideDeck = () =>
    shopWith(cardOffer, {
      sideDeck: [C("S", 3, "bonus"), C("D", 9, "wild"), C("C", 11, "steel")],
      sideSlots: 3,
    });
  const fullConsumables = () =>
    shopWith(consOffer, { consumables: [CONSUMABLES[1], CONSUMABLES[2]], consSlots: 2 });

  it("replaces the named joker and charges the full price", () => {
    const g = fullJokers();
    const after = gameReducer(g, { type: "buy", p: 0, index: 0, replace: 2 });
    expect(econOf(after, 0).jokers).toHaveLength(econOf(g, 0).jokerSlots);
    expect(econOf(after, 0).jokers.map((j) => j.id)).toEqual([
      JOKERS[1].id,
      JOKERS[2].id,
      JOKERS[4].id,
      JOKERS[0].id,
    ]);
    expect(econOf(after, 0).money).toBe(econOf(g, 0).money - jokerOffer.price);
    expect(econOf(after, 0).shop?.[0].sold).toBe(true);
    expect(after.toast).toBeNull();
  });

  /* Asserted by uid rather than by length: a pop() instead of a splice would
     keep the count and throw away the wrong card. */
  it("replaces the named tuppipakka card", () => {
    const g = fullSideDeck();
    const after = gameReducer(g, { type: "buy", p: 0, index: 0, replace: 1 });
    expect(econOf(after, 0).sideDeck).toHaveLength(econOf(g, 0).sideSlots);
    const uids = econOf(after, 0).sideDeck.map((c) => c.uid);
    expect(uids).toContain(econOf(g, 0).sideDeck[0].uid);
    expect(uids).not.toContain(econOf(g, 0).sideDeck[1].uid);
    expect(uids).toContain(econOf(g, 0).sideDeck[2].uid);
    const bought = econOf(after, 0).sideDeck[econOf(after, 0).sideDeck.length - 1];
    expect([bought.s, bought.r, bought.enh]).toEqual(["H", 7, "gold"]);
    expect(econOf(after, 0).money).toBe(econOf(g, 0).money - cardOffer.price);
    expect(econOf(after, 0).shop?.[0].sold).toBe(true);
    expect(after.toast).toBeNull();
  });

  it("replaces the named trick", () => {
    const g = fullConsumables();
    const after = gameReducer(g, { type: "buy", p: 0, index: 0, replace: 1 });
    expect(econOf(after, 0).consumables).toHaveLength(econOf(g, 0).consSlots);
    expect(econOf(after, 0).consumables.map((c) => c.id)).toEqual([
      CONSUMABLES[1].id,
      CONSUMABLES[0].id,
    ]);
    expect(econOf(after, 0).money).toBe(econOf(g, 0).money - consOffer.price);
    expect(econOf(after, 0).shop?.[0].sold).toBe(true);
    expect(after.toast).toBeNull();
  });

  /* An index nothing named must cost nothing: splice(-1, 1) would quietly
     drop the last joker, so the whole list is compared, not just its length. */
  it.each([-1, 4])("refuses a replace index of %i and keeps every joker", (replace) => {
    const g = fullJokers();
    const after = gameReducer(g, { type: "buy", p: 0, index: 0, replace });
    expect(econOf(after, 0).jokers.map((j) => j.id)).toEqual(econOf(g, 0).jokers.map((j) => j.id));
    expect(econOf(after, 0).money).toBe(econOf(g, 0).money);
    expect(econOf(after, 0).shop?.[0].sold).toBe(false);
    expect(after.toast?.key).toBe("toast.jokerSlotsFull");
  });

  it("discards nothing when the storage has room", () => {
    const g = shopWith(jokerOffer, { jokers: [JOKERS[1]], jokerSlots: 4 });
    const after = gameReducer(g, { type: "buy", p: 0, index: 0, replace: 0 });
    expect(econOf(after, 0).jokers.map((j) => j.id)).toEqual([JOKERS[1].id, JOKERS[0].id]);
    expect(econOf(after, 0).money).toBe(econOf(g, 0).money - jokerOffer.price);
    expect(econOf(after, 0).shop?.[0].sold).toBe(true);
  });

  /* The three guards stay the rule's authority even though the shop now offers
     the picker instead of reaching them, exactly as the swap panel no longer
     reaches toast.swapNoMatch. */
  const FULL: Array<[string, () => GameState, string, (g: GameState) => unknown]> = [
    ["toast.jokerSlotsFull", fullJokers, "toast.jokerSlotsFull", (g) => econOf(g, 0).jokers.length],
    ["toast.sideDeckFull", fullSideDeck, "toast.sideDeckFull", (g) => econOf(g, 0).sideDeck.length],
    [
      "toast.trickSlotsFull",
      fullConsumables,
      "toast.trickSlotsFull",
      (g) => econOf(g, 0).consumables.length,
    ],
  ];

  it.each(FULL)("raises %s for a buy with no replace", (_label, make, key, count) => {
    const g = make();
    const after = gameReducer(g, { type: "buy", p: 0, index: 0 });
    expect(after.toast?.key).toBe(key);
    expect(count(after)).toBe(count(g));
    expect(econOf(after, 0).money).toBe(econOf(g, 0).money);
    expect(econOf(after, 0).shop?.[0].sold).toBe(false);
  });

  it("pays out when selling a joker", () => {
    let g = withOver(createRun("SELL"), { money: 0 });
    const shop = gameReducer(withOver(g, { money: 50 }), { type: "toShop" });
    const jokerIdx = (econOf(shop, 0).shop ?? []).findIndex((i) => i.kind === "joker");
    if (jokerIdx < 0) return;
    g = gameReducer(shop, { type: "buy", p: 0, index: jokerIdx });
    const beforeSale = econOf(g, 0).money;
    g = gameReducer(g, { type: "sellJoker", p: 0, index: 0 });
    expect(econOf(g, 0).jokers).toHaveLength(0);
    expect(econOf(g, 0).money).toBeGreaterThan(beforeSale);
    expect(g.toast?.key).toBe("toast.soldJoker");
  });
});

/* ==================== the other three wallets stay empty ====================
   Only the owner's wallet is ever spent, and only its shop is rolled: rolling
   four shelves would draw four times the randomness and move every literal in
   seats.test.ts, and a shop for an AI seat has no buyer. */
describe("a blind and its shop leave the other seats' wallets untouched", () => {
  it("holds economies[1..3] at newEconomy() through a blind and a shop", () => {
    let s = playBlind(createRun("EMPTYWALLETS"), basicPolicy);
    while (s.screen?.kind === "dealend")
      s = playToScreen(advance(gameReducer(s, { type: "nextDeal" })), basicPolicy);
    expect(s.screen?.kind).toBe("cashout");
    /* The owner's purse moved, so the assertion below is about the other
       three and not about a run that never earned anything. */
    expect(econOf(s, 0).money).not.toBe(newEconomy().money);
    s = advance(gameReducer(s, { type: "toShop" }));
    expect(econOf(s, 0).shop).not.toBeNull();
    for (const p of [1, 2, 3] as const) expect(econOf(s, p)).toEqual(newEconomy());
  });
});

/* ==================== whose wallet the reducer banks from ====================
   resolveTrick hands scoreTrick the *owner's* seat, which in nolo and sooli is
   not the trick's winner: the game scores the tricks a side dodged. The
   golden run in seats.test.ts cannot see this decision, because basicPolicy
   never buys and so every wallet in it is empty and indistinguishable — this
   is where a wallet resolved from the winner instead of the owner shows up in
   a banked score rather than only in a unit-level call. */
describe("a dodged trick banks from the owner's wallet", () => {
  const jokerBy = (id: string) => {
    const j = JOKERS.find((x) => x.id === id);
    if (!j) throw new Error("no such joker: " + id);
    return j;
  };
  /* Nolo, seat 1 leads the ace and takes the trick, so team 0 scores it. */
  const trick: GameState["trick"] = [
    { p: 1, card: C("S", 14) },
    { p: 2, card: C("H", 5) },
    { p: 0, card: C("D", 7) },
    { p: 3, card: C("C", 9) },
  ];
  const resolve = (g: GameState) =>
    gameReducer({ ...g, phase: "resolve", leader: 1, turn: 1, mode: "nolo", trick }, {
      type: "resolveTrick",
    } as Action);

  const bare = createRun("WHOSEWALLET");
  /* nolomestari fires on any nolo trick, and the chip bonus is per card. */
  const owner = withEcon(bare, 0, { jokers: [jokerBy("nolomestari")], chipBonus: 4 });
  /* herttaherra scores a heart, and there is exactly one heart in the trick,
     so a wallet resolved from the winner (seat 1) or from either opponent
     gives a different base than one resolved from the owner. */
  const others = ([1, 2, 3] as const).reduce(
    (g, p) => withEcon(g, p, { jokers: [jokerBy("herttaherra")], chipBonus: 40 }),
    owner,
  );

  it("scores the owner's jokers and chip bonus, not the winner's", () => {
    expect(resolve(owner).base).toBeGreaterThan(resolve(bare).base);
    expect(resolve(owner).pop?.mult).toBe((resolve(bare).pop?.mult ?? 0) + 6);
    expect(resolve(owner).pop?.chips).toBe((resolve(bare).pop?.chips ?? 0) + 4 * trick.length);
  });

  it("banks the same score when the other three seats hold different wallets", () => {
    expect(resolve(others).base).toBe(resolve(owner).base);
    expect(resolve(others).pop).toEqual(resolve(owner).pop);
  });
});

/* The run total is a sum of blind scores the game already computed, so the
   test adds up the same numbers from the outside and compares. */
describe("the run total", () => {
  /* Plays whole blinds, collecting each blind score as cash-out banks it. */
  const bankBlinds = (seed: string, limit: number) => {
    let s = createRun(seed);
    const banked: number[] = [];
    for (let i = 0; i < limit; i++) {
      s = playBlind(s, basicPolicy);
      while (s.screen?.kind === "dealend") {
        s = playToScreen(advance(gameReducer(s, { type: "nextDeal" })), basicPolicy);
      }
      if (s.screen?.kind !== "cashout") break;
      banked.push(s.blindScore);
      s = advance(gameReducer(s, { type: "toShop" }));
      s = advance(gameReducer(s, { type: "nextBlind" }));
      if (s.screen?.kind === "victory") break;
    }
    return { state: s, banked };
  };

  const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

  it("adds up the blinds the run cleared", () => {
    const { state, banked } = bankBlinds("TOTALS", 2);
    expect(banked).toHaveLength(2);
    expect(banked.every((b) => b > 0)).toBe(true);
    expect(state.runScore).toBe(sum(banked));
  });

  /* A different seed from the test above, because this one needs a run that
     dies on a blind it scored something on — "TOTALS" now dies on a blind that
     scored nothing, since a new row in BIG_BOSSES changes what every seed
     draws. The blindScore assertion is what keeps the seed honest. */
  it("counts nothing for the blind the run dies on", () => {
    const { state, banked } = bankBlinds("RUNEND", 60);
    expect(state.screen?.kind).toBe("gameover");
    expect(banked.length).toBeGreaterThan(0);
    /* The failed blind scored something and none of it is banked: the total is
       exactly what cash-out took. */
    expect(state.blindScore).toBeGreaterThan(0);
    expect(state.runScore).toBe(sum(banked));
    expect(state.runScore).not.toBe(sum(banked) + state.blindScore);
  });

  it("starts a new run at zero", () => {
    const g = { ...createRun("TOTAL"), runScore: 12345 };
    expect(gameReducer(g, { type: "newRun" }).runScore).toBe(0);
  });
});

describe("a run", () => {
  it("keeps the best ante across a restart", () => {
    const g = { ...createRun("BEST"), bestAnte: 5 };
    expect(gameReducer(g, { type: "newRun" }).bestAnte).toBe(5);
    expect(gameReducer(g, { type: "newRun" }).ante).toBe(1);
  });

  it("plays several blinds without stalling", () => {
    const run = playRun("RUN", basicPolicy, 6);
    expect(["victory", "gameover", "limit"]).toContain(run.outcome);
    expect(run.deals.length).toBeGreaterThan(0);
    expect(run.deals.every((d) => d >= 0)).toBe(true);
  });

  it("never leaves a legal move undiscoverable in the play phase", () => {
    let g = advance(gameReducer(createRun("MOVES"), { type: "startBlind" }));
    while (g.phase === "declare") {
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", p: 0, decl: "nolo" }) : advance(g);
    }
    if (g.phase === "soolioffer") g = act(g, { type: "declineSooli", p: 0 });
    let guard = 0;
    while (g.phase === "play" && guard++ < 20) {
      expect(legalCards(g, 0).length).toBeGreaterThan(0);
      g = act(g, { type: "playCard", p: 0, uid: legalCards(g, 0)[0].uid });
      if (g.screen) break;
    }
  });
});

/* ==================== the ante ladder ====================
   Four blinds to an ante — small, big, small boss, big boss — and ten antes to
   a run. The boss is rolled inside startBlind, so a state under a named boss
   has to be found rather than written: a hand-set boss would be overwritten by
   the action itself. */
const openedUnder = (id: string, blindIdx: number, over: Partial<GameState> = {}): GameState => {
  for (let i = 0; i < 400; i++) {
    const g = gameReducer({ ...createRun(`BOSS${i}`), blindIdx, ...over }, { type: "startBlind" });
    if (g.boss?.id === id) return g;
  }
  throw new Error(`no seed in 400 rolled the boss ${id}`);
};

const seedUnder = (id: string, blindIdx: number): string => {
  for (let i = 0; i < 400; i++) {
    const seed = `BOSS${i}`;
    if (gameReducer({ ...createRun(seed), blindIdx }, { type: "startBlind" }).boss?.id === id)
      return seed;
  }
  throw new Error(`no seed in 400 rolled the boss ${id}`);
};

describe("an ante is four blinds", () => {
  it("walks 0 to 3 and rolls the ante over only from the last blind", () => {
    let g: GameState = createRun("LADDER");
    const walked: number[] = [];
    for (let i = 0; i < 3; i++) {
      walked.push(g.blindIdx);
      g = gameReducer(g, { type: "nextBlind" });
      expect(g.ante).toBe(1);
    }
    walked.push(g.blindIdx);
    expect(walked).toEqual([0, 1, 2, 3]);
    expect(g.beaten).toEqual([true, true, true, false]);

    const rolled = gameReducer(g, { type: "nextBlind" });
    expect(rolled.ante).toBe(2);
    expect(rolled.blindIdx).toBe(0);
    expect(rolled.beaten).toEqual([false, false, false, false]);
    expect(rolled.screen).toEqual({ kind: "blindselect" });
  });

  it("draws the two bosses from different pools and scales the four targets", () => {
    let g: GameState = createRun("ANTEONE");
    const bosses: Array<string | null> = [];
    const targets: number[] = [];
    for (let i = 0; i < 4; i++) {
      const opened = gameReducer(g, { type: "startBlind" });
      expect(opened.blindIdx).toBe(i);
      bosses.push(opened.boss?.id ?? null);
      targets.push(opened.target);
      g = gameReducer(opened, { type: "nextBlind" });
    }
    expect(bosses[0]).toBeNull();
    expect(bosses[1]).toBeNull();
    expect(SMALL_BOSSES.map((b) => b.id)).toContain(bosses[2]);
    expect(BIG_BOSSES.map((b) => b.id)).toContain(bosses[3]);
    /* Disjoint pools, so the ante's two bosses cannot be the same one. */
    expect(bosses[2]).not.toBe(bosses[3]);

    const a = ANTES[0];
    expect(targets).toEqual([a, Math.round(a * 1.5), a * 2, Math.round(a * 2.5)]);
  });

  it("opens victory on the big boss of the tenth ante and not before", () => {
    const at = (ante: number, blindIdx: number) => ({ ...createRun("WIN"), ante, blindIdx });

    const last = gameReducer(at(10, 2), { type: "nextBlind" });
    expect(last.blindIdx).toBe(3);
    expect(last.ante).toBe(10);
    expect(last.screen).toEqual({ kind: "blindselect" });

    const won = gameReducer(at(10, 3), { type: "nextBlind" });
    expect(won.screen).toEqual({ kind: "victory" });
    expect(won.bestAnte).toBeGreaterThanOrEqual(11);

    /* The ninth ante's big boss is a rollover, not a win. */
    const ninth = gameReducer(at(9, 3), { type: "nextBlind" });
    expect(ninth.ante).toBe(10);
    expect(ninth.blindIdx).toBe(0);
    expect(ninth.screen).toEqual({ kind: "blindselect" });
  });

  it.each([2, 3])("refuses to skip the boss blind at index %i", (blindIdx) => {
    const g = withOver(createRun("SKIP"), { blindIdx, money: 12 });
    const after = gameReducer(g, { type: "skipBlind" });
    expect(after.blindIdx).toBe(blindIdx);
    expect(econOf(after, 0).money).toBe(12);
    expect(after.beaten).toEqual(g.beaten);
  });

  it.each([0, 1])("still skips the ordinary blind at index %i", (blindIdx) => {
    const g = withOver(createRun("SKIP"), { blindIdx, money: 12 });
    const after = gameReducer(g, { type: "skipBlind" });
    expect(after.blindIdx).toBe(blindIdx + 1);
    expect(econOf(after, 0).money).toBe(14);
    expect(after.beaten[blindIdx]).toBe(true);
  });
});

describe("the new bosses", () => {
  it("takes a deal off the blind under Kiire", () => {
    const g = openedUnder("kiire", 3);
    expect(g.deals).toBe(4);
    expect(g.blindDeals).toBe(Math.max(1, g.deals - 1));
    expect(g.blindDeals).toBe(3);
    expect(g.dealsLeft).toBe(3);

    /* Every other blind is still the run's full allowance. */
    expect(openedUnder("harmaus", 3).blindDeals).toBe(4);
    expect(gameReducer(createRun("PLAIN"), { type: "startBlind" }).blindDeals).toBe(4);

    let s = playToScreen(advance(g), basicPolicy);
    let played = 1;
    while (s.screen?.kind === "dealend") {
      s = playToScreen(advance(gameReducer(s, { type: "nextDeal" })), basicPolicy);
      played++;
    }
    expect(played).toBeLessThanOrEqual(3);
    expect(s.dealsLeft).toBe(g.blindDeals - played);
    expect(["cashout", "gameover"]).toContain(s.screen?.kind);
  });

  /* Harmaus closes the tuppipakka. The side deck below holds the twin of a card
     actually dealt, so the swap phase would open without the boss — asserted
     through anySwapAvailable rather than assumed. */
  it("closes the side deck under Harmaus, on every deal of the blind", () => {
    const seed = seedUnder("harmaus", 3);
    const pre = { ...createRun(seed), blindIdx: 3 };
    const dealt = gameReducer(pre, { type: "startBlind" });
    const twin = dealt.hands[0][0];
    const g = gameReducer(withOver(pre, { sideDeck: [C(twin.s, twin.r, "wild")] }), {
      type: "startBlind",
    });

    expect(g.boss?.id).toBe("harmaus");
    expect(econOf(g, 0).swapsLeft).toBe(0);
    /* anySwapAvailable reads the hand and the side deck, not the swaps left,
       so it says the deal would otherwise have had a swap to make. */
    expect(anySwapAvailable(g, 0)).toBe(true);
    expect(g.phase).not.toBe("swap");
    expect(g.hands[0].every((c) => !c.enh)).toBe(true);

    /* The swaps are refilled at every deal, not at every blind, so the second
       deal of the blind is where a gate placed in startBlind alone falls
       through. The target is pushed out of reach so the blind cannot end on
       its first deal, and the side deck is armed with a twin of the second
       deal's hand as well — otherwise the phase assertion would pass on a deal
       that had no swap to make anyway. The extra card changes no roll: under
       this boss nothing is ever swapped. */
    const far = { ...g, target: 10 ** 9 };
    const probe = gameReducer(playToScreen(advance(far), basicPolicy), { type: "nextDeal" });
    const twin2 = probe.hands[0][0];
    const armed = withOver(far, {
      sideDeck: [...econOf(far, 0).sideDeck, C(twin2.s, twin2.r, "wild")],
    });

    const first = playToScreen(advance(armed), basicPolicy);
    expect(first.screen?.kind).toBe("dealend");
    const second = gameReducer(first, { type: "nextDeal" });
    expect(anySwapAvailable(second, 0)).toBe(true);
    expect(econOf(second, 0).swapsLeft).toBe(0);
    expect(second.phase).not.toBe("swap");
    expect(second.hands[0].every((c) => !c.enh)).toBe(true);
  });

  it("pays no interest at the cash-out under Verokarhu", () => {
    const opened = openedUnder("verokarhu", 2);
    /* Enough money that the interest would be the full $5 without the boss:
       a poor purse would score 0 interest either way and prove nothing. */
    const at = withOver(opened, {
      phase: "handend" as const,
      screen: null,
      money: 40,
      blindScore: opened.target,
      handScore: opened.target,
      dealsLeft: 2,
    });

    const taxed = gameReducer(at, { type: "showHandResult" });
    expect(taxed.screen?.kind).toBe("cashout");
    if (taxed.screen?.kind !== "cashout") return;
    expect(taxed.screen.interest).toBe(0);
    expect(econOf(taxed, 0).money).toBe(
      40 + taxed.screen.reward + taxed.screen.bonus + taxed.screen.spare,
    );

    const free = gameReducer({ ...at, boss: null }, { type: "showHandResult" });
    if (free.screen?.kind !== "cashout") throw new Error("no cash-out without the boss");
    expect(free.screen.interest).toBe(5);
    expect(econOf(free, 0).money).toBe(econOf(taxed, 0).money + 5);
  });
});

/* The board is reachable from every screen and from the rail mid-deal, so
   opening and closing it happens far more often than the rules panel ever did.
   The two fields exist so the view underneath survives it. */
describe("a modal the player opens", () => {
  /* A deal-end screen with something already banked into blindScore: a blind
     the bot clears in one deal never shows one, and a wasted deal leaves the
     score at 0, so both are played past. */
  const toDealEnd = (): GameState => {
    let g = playBlind(createRun("MODAL3"), basicPolicy);
    for (let guard = 0; guard < 20; guard++) {
      if (g.screen?.kind === "dealend" && g.blindScore > 0) return g;
      if (g.screen?.kind === "dealend") {
        g = playToScreen(advance(gameReducer(g, { type: "nextDeal" })), basicPolicy);
        continue;
      }
      if (g.screen?.kind !== "cashout") break;
      g = advance(gameReducer(g, { type: "toShop" }));
      g = advance(gameReducer(g, { type: "nextBlind" }));
      g = playBlind(g, basicPolicy);
    }
    throw new Error(`no deal-end screen with a score: ${g.screen?.kind}`);
  };

  /* Into the second deal of the blind: the first deal's score is on
     blindScore and a trick has been played, so the named checks below are on
     fields that are not at their defaults. A state fresh from startBlind has
     blindScore 0 and screen null, and a check on a default cannot fail. */
  const midDeal = (): GameState => {
    let g = advance(gameReducer(toDealEnd(), { type: "nextDeal" }));
    for (let guard = 0; guard < 200 && !g.screen && g.trickNo === 0; guard++) {
      if (g.phase === "swap") g = act(g, { type: "finishSwap", p: 0 });
      else if (g.phase === "declare")
        g = act(g, { type: "declare", p: 0, decl: basicPolicy.declare(g, 0) });
      else if (g.phase === "soolioffer") g = act(g, { type: "declineSooli", p: 0 });
      else if (g.phase === "sooligive")
        g = act(g, { type: "sooliGive", p: 0, uid: basicPolicy.sooliGive(g, 0) });
      else if (g.phase === "sooliready") g = act(g, { type: "startSooliPlay", p: 0 });
      else g = act(g, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(g, 0) });
    }
    return g;
  };

  /* Mid-deal the rail opens it; from a screen the screen's own button does,
     and that is the case where g.screen has something to lose. */
  const cases = (): Array<[string, GameState]> => {
    const mid = midDeal();
    return [
      ["mid-deal", mid],
      ["over the deal-end screen", toDealEnd()],
    ];
  };

  it.each(cases())(
    "leaves the rest of the state alone when the board opens and closes: %s",
    (_label, before) => {
      const opened = gameReducer(before, { type: "openModal", modal: "scores" });
      expect(opened.modal).toBe("scores");
      const closed = gameReducer(opened, { type: "closeModal" });
      expect(closed.modal).toBeNull();
      expect(closed).toEqual(before);
      /* Named as well as deep-equalled: a deep comparison that started
         passing for the wrong reason would not say which field moved. */
      expect(closed.screen).toEqual(before.screen);
      expect(closed.phase).toBe(before.phase);
      expect(closed.blindScore).toBe(before.blindScore);
      expect(closed.rngState).toBe(before.rngState);
      expect(closed.uidSeq).toBe(before.uidSeq);
    },
  );

  /* The guard on the two states above: a field at its default is a check that
     cannot fail, which is how the first version of this test passed while
     asserting null against null and 0 against 0. */
  it("opens and closes over states where those fields carry something", () => {
    const [[, mid], [, onScreen]] = cases();
    expect(mid.screen).toBeNull();
    expect(mid.phase).toBe("play");
    expect(mid.trickNo).toBeGreaterThan(0);
    expect(mid.blindScore).toBeGreaterThan(0);
    expect(onScreen.screen).not.toBeNull();
    expect(onScreen.blindScore).toBeGreaterThan(0);
  });
});

describe("the start menu", () => {
  /* A deal with cards on the table and a trick already under way: a check on
     a field at its default cannot fail. */
  const midTrick = (): GameState => {
    let g = advance(start("MENU"));
    for (let guard = 0; guard < 100; guard++) {
      if (g.screen) break;
      if (g.phase === "play" && g.trick.length > 0) return g;
      if (g.phase === "swap") g = act(g, { type: "finishSwap", p: 0 });
      else if (g.phase === "declare")
        g = act(g, { type: "declare", p: 0, decl: basicPolicy.declare(g, 0) });
      else if (g.phase === "soolioffer") g = act(g, { type: "declineSooli", p: 0 });
      else if (g.phase === "sooligive")
        g = act(g, { type: "sooliGive", p: 0, uid: basicPolicy.sooliGive(g, 0) });
      else if (g.phase === "sooliready") g = act(g, { type: "startSooliPlay", p: 0 });
      else g = act(g, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(g, 0) });
    }
    throw new Error(`no trick under way: ${g.phase}`);
  };

  it("raises and lowers over a deal without touching it", () => {
    const before = midTrick();
    expect(before.menu).toBeNull();
    const opened = gameReducer(before, { type: "showMenu", view: "start" });
    expect(opened.menu).toBe("start");
    /* Named as well as deep-equalled: a deep comparison that broke would not
       say which field the menu moved. */
    expect(opened.phase).toBe(before.phase);
    expect(opened.hands).toEqual(before.hands);
    expect(opened.trick).toEqual(before.trick);
    expect(opened).toEqual({ ...before, menu: "start" });
    expect(gameReducer(opened, { type: "closeMenu" })).toEqual(before);
  });

  it("carries the challenges view in the same field", () => {
    const g = gameReducer(createRun("MENU"), { type: "showMenu", view: "challenges" });
    expect(g.menu).toBe("challenges");
    expect(gameReducer(g, { type: "closeMenu" }).menu).toBeNull();
  });

  /* A run started from the menu leaves it, and is one the menu will offer a
     Continue back to when it is raised again. */
  it("leaves the menu and becomes continuable when a run starts", () => {
    const g = gameReducer({ ...createRun("MENU"), menu: "start" }, { type: "newRun" });
    expect(g.menu).toBeNull();
    expect(g.runStarted).toBe(true);
    expect(createRun("MENU").runStarted).toBe(false);
  });

  /* The rail raises the menu mid-deal, where g.screen is null and every
     automatic step still has a tick to give. The opponents must not play on
     behind it. */
  it("stops the clock while it is up", () => {
    const mid = midTrick();
    /* One card played and deliberately not advanced, so a step is pending:
       the state midTrick returns is one the clock has already settled. */
    const g = gameReducer(mid, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(mid, 0) });
    expect(g.screen).toBeNull();
    expect(nextTick(g)).not.toBeNull();
    expect(nextTick({ ...g, menu: "start" })).toBeNull();
    expect(nextTick({ ...g, menu: "challenges" })).toBeNull();
    /* The lobby is a third view of the same field, so the blanket guard covers
       it — narrowing that guard to a list of views is what this would catch. */
    expect(nextTick({ ...g, menu: "lobby" })).toBeNull();
  });
});

/* ==================== the seat the run is played from ====================
   The lobby picks it; createRun builds `seats` from it. Nothing else in the
   engine may learn who is looking. */
describe("a run is started at a seat", () => {
  it("keeps createRun's default at seat 0, exactly as it was", () => {
    expect(createRun("X")).toEqual(createRun("X", 0, 0));
    expect(createRun("X").seats).toEqual(["human", "ai", "ai", "ai"]);
  });

  it.each([0, 1, 2, 3] as const)("puts the one human seat at %s", (seat) => {
    const g = createRun("SEATED", 0, seat);
    expect(g.seats.filter((k) => k === "human")).toHaveLength(1);
    expect(g.seats[seat]).toBe("human");
    expect(ownerSeat(g)).toBe(seat);
  });

  it("carries the seat through newRun and leaves the menu", () => {
    const g = gameReducer({ ...createRun("LOBBY"), menu: "lobby" }, { type: "newRun", seat: 2 });
    expect(g.seats).toEqual(["ai", "ai", "human", "ai"]);
    expect(ownerSeat(g)).toBe(2);
    expect(g.runStarted).toBe(true);
    expect(g.menu).toBeNull();
    /* Every wallet starts empty, the owner's included: the seat decides whose
       purse the shell will be, not how much is in it. */
    for (const p of [0, 1, 2, 3] as const) expect(econOf(g, p)).toEqual(newEconomy());
  });

  it("seats the human at 0 when newRun names no seat", () => {
    const g = gameReducer(createRun("LOBBY"), { type: "newRun" });
    expect(g.seats).toEqual(["human", "ai", "ai", "ai"]);
  });

  /* Entering a challenge from a run seated at 2 must not move the player back
     to seat 0 — the deal would then be played by an AI in their own chair. */
  it("plays a challenge from the seat the parked run was played at", () => {
    const running = { ...createRun("PARKSEAT", 0, 2), runStarted: true };
    const chal = gameReducer(running, { type: "startChallenge", id: "rummikub" });
    expect(chal.seats).toEqual(["ai", "ai", "human", "ai"]);
    expect(ownerSeat(chal)).toBe(2);

    const back = gameReducer(chal, { type: "leaveChallenge" });
    expect(back.challenge).toBeNull();
    expect(back.seed).toBe(running.seed);
    expect(back.seats).toEqual(["ai", "ai", "human", "ai"]);
    expect(ownerSeat(back)).toBe(2);
  });
});

describe("tricks (consumables)", () => {
  it("refuses to fire outside the play phase", () => {
    const g = withOver(createRun("CONS"), {
      consumables: [{ id: "kurkistus", key: "cons.kurkistus", g: "◉", p: 3 }],
    });
    const after = gameReducer(g, { type: "useConsumable", p: 0, index: 0 });
    expect(econOf(after, 0).consumables).toHaveLength(1);
    expect(after.toast?.key).toBe("toast.waitForDeal");
  });

  it("reveals the opponents' hands with Kurkistus", () => {
    const base = start("CONS");
    const g = withOver(base, {
      phase: "play" as const,
      consumables: [{ id: "kurkistus", key: "cons.kurkistus", g: "◉", p: 3 }],
    });
    const after = gameReducer(g, { type: "useConsumable", p: 0, index: 0 });
    expect(after.reveal).toBe(true);
    expect(econOf(after, 0).consumables).toHaveLength(0);
  });

  it("flips the declaration with Kannanvaihto only before the first trick", () => {
    const base = start("CONS");
    const cons = { id: "kannanvaihto", key: "cons.kannanvaihto", g: "↕", p: 5 };
    const early = gameReducer(
      withOver(base, { phase: "play", mode: "rami" as Mode, trickNo: 0, consumables: [cons] }),
      { type: "useConsumable", p: 0, index: 0 },
    );
    expect(early.mode).toBe("nolo");

    const late = gameReducer(
      withOver(base, { phase: "play", mode: "rami" as Mode, trickNo: 3, consumables: [cons] }),
      { type: "useConsumable", p: 0, index: 0 },
    );
    expect(late.mode).toBe("rami");
    expect(econOf(late, 0).consumables).toHaveLength(1);
  });
});

/* Temppukielto shuts the tricks for its whole blind. The reducer is the
   authority: the buttons are disabled too, but the guard is what the rule
   lives in, exactly as with toast.swapNoMatch. */
describe("the trick ban (temppukielto)", () => {
  const BAN = BIG_BOSSES[BIG_BOSSES.length - 1];
  const banned = (over: StateOver = {}): GameState =>
    withOver(start("BAN"), {
      phase: "play",
      boss: BAN,
      consumables: [CONSUMABLES[1], CONSUMABLES[0]],
      ...over,
    });

  it("names temppukielto as the last big boss", () => {
    expect(BAN.id).toBe("temppukielto");
  });

  it("refuses a trick in the play phase and keeps it", () => {
    const g = banned();
    const after = gameReducer(g, { type: "useConsumable", p: 0, index: 0 });
    expect(econOf(after, 0).consumables.map((c) => c.id)).toEqual(
      econOf(g, 0).consumables.map((c) => c.id),
    );
    expect(after.toast?.key).toBe("toast.tricksBanned");
  });

  /* The boss guard sits ahead of the phase guard, so the player hears about the
     boss rather than about the phase — the phase will pass, the boss will not. */
  it("blames the boss and not the phase outside the play phase", () => {
    const after = gameReducer(banned({ phase: "trickend" }), {
      type: "useConsumable",
      p: 0,
      index: 0,
    });
    expect(after.toast?.key).toBe("toast.tricksBanned");
    expect(after.toast?.key).not.toBe("toast.waitForDeal");
  });

  /* Every trick, not only the two that already carry guards of their own: a
     guard scoped to uusijako and kannanvaihto would let the other three fire. */
  it.each(CONSUMABLES.map((c) => [c.id, c] as const))("refuses %s", (_id, cons) => {
    const g = banned({ consumables: [cons], mode: "rami", trickNo: 0 });
    const after = gameReducer(g, { type: "useConsumable", p: 0, index: 0 });
    expect(econOf(after, 0).consumables.map((c) => c.id)).toEqual([cons.id]);
    expect(after.reveal).toBe(g.reveal);
    expect(after.steal).toBe(g.steal);
    expect(after.mode).toBe(g.mode);
    expect(after.hands[0].map((c) => c.uid)).toEqual(g.hands[0].map((c) => c.uid));
  });

  /* The boss binds the deals, not the shop, and d.boss is still set while the
     shop after the big boss blind is open. */
  it("still sells a trick in the shop", () => {
    const g = withOver(createRun("BANSHOP"), {
      money: 50,
      phase: "shop",
      screen: { kind: "shop" },
      boss: BAN,
      consumables: [],
      shop: [{ kind: "consumable", data: CONSUMABLES[0], price: 4, sold: false }],
    });
    const after = gameReducer(g, { type: "buy", p: 0, index: 0 });
    expect(econOf(after, 0).consumables.map((c) => c.id)).toEqual([CONSUMABLES[0].id]);
    expect(econOf(after, 0).consSlots).toBe(econOf(g, 0).consSlots);
    expect(econOf(after, 0).money).toBe(econOf(g, 0).money - 4);
    expect(after.toast).toBeNull();
  });

  /* Nothing armed before the boss blind leaks into it. startDeal already does
     the reset; this pins it so a refactor cannot open a back door. BAN1 is a
     seed whose big boss blind draws temppukielto, and the assertion on the id
     keeps the test from passing vacuously if the pool ever changes. */
  it("arrives with kurkistus and tikkivarkaus disarmed", () => {
    const g = gameReducer(
      { ...createRun("BAN1"), blindIdx: 3, reveal: true, steal: true },
      { type: "startBlind" },
    );
    expect(g.boss?.id).toBe("temppukielto");
    expect(g.reveal).toBe(false);
    expect(g.steal).toBe(false);
  });
});

/* Support: a counter over the tricks the player's pair collects. "Collected"
   means won, not scored — those differ in nolo and sooli, so both directions
   are asserted here, and together they pin the hook to the winner rather than
   to the scoring branch. */
describe("party support", () => {
  const g0 = createRun("PARTY");
  const total = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);
  const cardOf = (id: string) => C(id[0] as Suit, Number(id.slice(1)));
  const idsIn = (suit: string) => Object.keys(g0.partyMap).filter((id) => id[0] === suit);
  const partyIn = (suit: string, not: string[]) => {
    const id = idsIn(suit).find((x) => !not.includes(g0.partyMap[x]));
    if (!id) throw new Error("no spare party in " + suit);
    return id;
  };

  /* Seat 0 leads the only card of the led suit, so it takes the trick
     whatever the other three play. */
  const resolving = (over: Partial<GameState>) =>
    gameReducer({ ...g0, phase: "resolve", leader: 0, turn: 0, ...over } as GameState, {
      type: "resolveTrick",
    });

  it("gives one support per card of a trick our side wins", () => {
    /* One party twice, so a per-distinct-party tally would come to three, and
       a winner-only tally to one. */
    const P = g0.partyMap["S14"];
    const twin = idsIn("H").find((id) => g0.partyMap[id] === P);
    const dId = partyIn("D", [P]);
    const cId = partyIn("C", [P, g0.partyMap[dId]]);
    expect(twin).toBeDefined();

    const after = resolving({
      mode: "rami",
      ramTeam: 0,
      /* Non-zero to start with, so writing 1 instead of adding 1 fails. */
      support: { ...g0.support, [P]: 5 },
      trick: [
        { p: 0, card: cardOf("S14") },
        { p: 1, card: cardOf(twin as string) },
        { p: 2, card: cardOf(dId) },
        { p: 3, card: cardOf(cId) },
      ],
    });

    expect(after.winSeat).toBe(0);
    expect(total(after.support) - 5).toBe(4);
    expect(after.support[P]).toBe(7);
    expect(after.support[g0.partyMap[dId]]).toBe(1);
    expect(after.support[g0.partyMap[cId]]).toBe(1);
  });

  /* In nolo the opponents' trick is the one that scores, so this is where a
     hook hung off the scoring branch instead of the winner shows up. */
  it("gives nothing for a trick the opponents win, even when it scores", () => {
    const seeded = Object.fromEntries(PARTY_IDS.map((p, i) => [p, i + 1]));
    const after = resolving({
      mode: "nolo",
      support: seeded,
      leader: 1,
      trick: [
        { p: 1, card: cardOf("S14") },
        { p: 2, card: cardOf("H5") },
        { p: 0, card: cardOf("D7") },
        { p: 3, card: cardOf("C9") },
      ],
    });

    expect(after.winSeat).toBe(1);
    expect(after.support).toEqual(seeded);
    expect(after.base).toBeGreaterThan(0);
  });

  it("gives support for a trick we win in nolo, which scores nothing", () => {
    const after = resolving({
      mode: "nolo",
      trick: [
        { p: 0, card: cardOf("S14") },
        { p: 1, card: cardOf("H5") },
        { p: 2, card: cardOf("D7") },
        { p: 3, card: cardOf("C9") },
      ],
    });

    expect(after.winSeat).toBe(0);
    expect(total(after.support)).toBe(4);
    expect(after.base).toBe(0);
    expect(after.pop).toBeNull();
  });

  it("follows the winner the theft consumable installs", () => {
    const after = resolving({
      mode: "rami",
      ramTeam: 0,
      steal: true,
      leader: 1,
      trick: [
        { p: 1, card: cardOf("S14") },
        { p: 0, card: cardOf("S3") },
        { p: 2, card: cardOf("H5") },
        { p: 3, card: cardOf("D7") },
      ],
    });

    expect(after.winSeat).toBe(0);
    expect(total(after.support)).toBe(4);
  });

  it("accumulates across deals and starts over only on a new run", () => {
    const P = g0.partyMap["S14"];
    const carried = gameReducer(
      { ...g0, support: { ...g0.support, [P]: 7 } },
      { type: "nextDeal" },
    );
    expect(carried.support[P]).toBe(7);

    const more = resolving({
      mode: "rami",
      ramTeam: 0,
      support: carried.support,
      trick: [
        { p: 0, card: cardOf("S14") },
        { p: 1, card: cardOf("H5") },
        { p: 2, card: cardOf("D7") },
        { p: 3, card: cardOf("C9") },
      ],
    });
    expect(more.support[P]).toBeGreaterThan(7);
    expect(total(more.support)).toBe(11);

    const fresh = gameReducer(more, { type: "newRun", seed: "PARTY2" });
    expect(Object.keys(fresh.support).sort()).toEqual(PARTY_IDS.slice().sort());
    expect(Object.values(fresh.support).every((n) => n === 0)).toBe(true);
  });

  /* startBlind zeroes blindScore and refills dealsLeft, so it is the natural
     place for a reset of support to be added by mistake — and nextDeal alone
     would not catch it. Both boundaries are crossed here: blind to blind, and
     the last blind of the ante to the next ante. */
  it("survives a blind boundary and an ante boundary", () => {
    const P = g0.partyMap["S14"];
    const seeded = { ...g0.support, [P]: 9 };

    const nextB = gameReducer({ ...g0, support: seeded }, { type: "nextBlind" });
    expect(nextB.blindIdx).toBe(1);
    const opened = gameReducer(nextB, { type: "startBlind" });
    expect(opened.blindScore).toBe(0);
    expect(opened.support[P]).toBe(9);
    expect(total(opened.support)).toBe(9);

    const nextA = gameReducer({ ...g0, support: seeded, blindIdx: 3 }, { type: "nextBlind" });
    expect(nextA.ante).toBe(2);
    expect(nextA.blindIdx).toBe(0);
    expect(gameReducer(nextA, { type: "startBlind" }).support[P]).toBe(9);

    /* Skipping a blind crosses the same boundary without a screen. */
    const skipped = gameReducer({ ...g0, support: seeded }, { type: "skipBlind" });
    expect(skipped.blindIdx).toBe(1);
    expect(gameReducer(skipped, { type: "startBlind" }).support[P]).toBe(9);
  });

  /* The aggregate that catches every miscount at once. Pinned to a non-sooli
     deal on purpose: a sooli trick holds three cards and the partner sits out,
     so the four-per-trick identity below is false there and would fail
     confusingly the first time this seed dealt one. */
  it("collects one per card of every collected trick over a whole deal", () => {
    const g = playBlind(createRun("PARTYSUM"));
    expect(g.sooli).toBe(false);
    const n = trickSize(g);
    expect(n).toBe(4);
    expect(g.tricks[0] + g.tricks[1]).toBe(13);
    expect(total(g.support)).toBe(n * g.tricks[0]);
    expect(total(g.support) + n * g.tricks[1]).toBe(13 * n);
  });

  /* The sooli case the identity above cannot cover: three cards to a trick,
     and our side's only collected trick is the one that breaks the sooli. */
  it("collects three from a sooli trick, not four", () => {
    const after = resolving({
      mode: "rami",
      ramTeam: 0,
      sooli: true,
      sooliSeat: 0,
      sooliOrder: [1, 3, 0],
      trick: [
        { p: 0, card: cardOf("S14") },
        { p: 1, card: cardOf("H5") },
        { p: 3, card: cardOf("D7") },
      ],
    });

    expect(after.winSeat).toBe(0);
    expect(after.sooliBust).toBe(true);
    expect(total(after.support)).toBe(3);
  });

  /* The bust reads sooliSeat, not seat 0. Every other sooli fixture seats the
     soloist at 0, where `w.p === d.sooliSeat` and `w.p === 0` cannot be told
     apart — a mutation check found the pair indistinguishable and this is what
     separates them. Seat 1 is the soloist here, and the seat that must not
     bust is 0: the old code busted on exactly that trick. */
  it("busts the sooli seated somewhere other than seat 0", () => {
    const soloWins = resolving({
      mode: "rami",
      ramTeam: 1,
      sooli: true,
      sooliSeat: 1,
      sooliOrder: [0, 2, 1],
      leader: 1,
      turn: 1,
      trick: [
        { p: 1, card: cardOf("S14") },
        { p: 2, card: cardOf("H5") },
        { p: 0, card: cardOf("D7") },
      ],
    });
    expect(soloWins.winSeat).toBe(1);
    expect(soloWins.sooliBust).toBe(true);

    const soloDodges = resolving({
      mode: "rami",
      ramTeam: 1,
      sooli: true,
      sooliSeat: 1,
      sooliOrder: [0, 2, 1],
      trick: [
        { p: 0, card: cardOf("S14") },
        { p: 2, card: cardOf("H5") },
        { p: 1, card: cardOf("D7") },
      ],
    });
    expect(soloDodges.winSeat).toBe(0);
    expect(soloDodges.sooliBust).toBe(false);
  });
});

/* ============================ the challenge ============================ */

/* A state parked in the laydown, so the turn cycle can be driven by hand
   without playing thirteen tricks first. */
const layingDown = (over: Partial<GameState> = {}): GameState => ({
  ...createRun("LAYTEST"),
  challenge: "rummikub",
  mode: "rami",
  phase: "laydown",
  screen: null,
  tricks: [7, 6],
  layHands: [[], []],
  ...over,
});

/* The thirteenth trick of a challenge deal, so startLaydown decides layTurn
   from the split rather than a test writing it. */
const laydownFrom = (us: number, them: number): GameState =>
  gameReducer(
    {
      ...createRun("LAYTURN"),
      challenge: "rummikub",
      mode: "rami",
      phase: "trickend",
      screen: null,
      trickNo: 12,
      tricks: [us, them],
      layHands: [[C("S", 9)], [C("H", 3)]],
      winSeat: 0,
    },
    { type: "endTrick" },
  );

/* A real challenge deal played to the moment the laydown opens, and no
   further: `advance` would run the opponents' turns too. */
function toLaydown(seed: string): GameState {
  let s = gameReducer(createRun(seed), { type: "startChallenge", id: "rummikub" });
  for (let guard = 0; guard < 3000; guard++) {
    if (s.phase === "laydown") return s;
    if (s.phase === "play" && s.turn === 0) {
      s = gameReducer(s, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(s, 0) });
      continue;
    }
    const tick = nextTick(s);
    if (!tick) throw new Error(`stuck in ${s.phase}`);
    s = gameReducer(s, tick.action);
  }
  throw new Error("did not reach the laydown");
}

describe("a challenge run", () => {
  const start = (seed = "CHAL1", over: StateOver = {}) =>
    advance(
      gameReducer(withOver(createRun(seed), over), { type: "startChallenge", id: "rummikub" }),
    );

  it("drops the whole roguelike shell", () => {
    const loaded: StateOver = {
      money: 42,
      jokers: [JOKERS[0], JOKERS[1]],
      consumables: [CONSUMABLES[0]],
      vouchers: [VOUCHERS[0].id],
      sideDeck: [C("S", 14, "wild")],
      boss: SMALL_BOSSES[0],
      target: 5000,
      runStarted: true,
    };
    const g = start("CHAL1", loaded);

    expect(g.challenge).toBe("rummikub");
    expect(g.runStarted).toBe(true);
    expect(g.menu).toBeNull();
    expect(econOf(g, 0).money).toBe(0);
    expect(g.target).toBe(0);
    expect(econOf(g, 0).jokers).toEqual([]);
    expect(econOf(g, 0).consumables).toEqual([]);
    expect(econOf(g, 0).vouchers).toEqual([]);
    expect(econOf(g, 0).sideDeck).toEqual([]);
    expect(g.boss).toBeNull();
    expect(g.deals).toBe(4);
    expect(g.blindDeals).toBe(4);
    expect(g.dealsLeft).toBe(4);
    /* Dealt already: no blind select to click through. */
    expect(g.screen).toBeNull();
    expect(g.hands[0]).toHaveLength(13);
  });

  it("forces rami and leads with the elder hand", () => {
    const g = start();
    expect(g.mode).toBe("rami");
    expect(g.ramSeat).toBeNull();
    expect(g.ramTeam).toBeNull();
    expect(g.phase).toBe("play");
    /* createRun's dealer is 3, so the elder hand is seat 0. */
    expect(g.leader).toBe(0);
    expect(g.turn).toBe(0);
  });

  it("visits exactly play, resolve, trickend, laydown and handend", () => {
    const seen = new Set<string>();
    let s = start("CHALPHASE");
    for (let guard = 0; guard < 3000 && !s.screen; guard++) {
      seen.add(s.phase);
      if (s.phase === "play" && s.turn === 0) {
        s = gameReducer(s, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(s, 0) });
      } else if (s.phase === "laydown" && s.layTurn === 0) {
        const combos = basicPolicy.laydown(s, 0);
        s = gameReducer(
          s,
          combos ? { type: "layCards", p: 0, combos } : { type: "passLaydown", p: 0 },
        );
      } else {
        const tick = nextTick(s);
        if (!tick) throw new Error(`nothing to do in ${s.phase}`);
        s = gameReducer(s, tick.action);
      }
      seen.add(s.phase);
    }
    expect([...seen].sort()).toEqual(["handend", "laydown", "play", "resolve", "trickend"]);
  });

  it("never turns on a sooli, a shop or a blind", () => {
    const r = playChallenge("CHALFLOW");
    expect(r.state.sooli).toBe(false);
    expect(econOf(r.state, 0).shop).toBeNull();
    expect(r.state.blindIdx).toBe(0);
    expect(r.state.ante).toBe(1);
    expect(r.state.screen?.kind).toBe("challengeover");
  });

  it("scores nothing in the tricks and never touches the money", () => {
    let s = start("CHALSCORE");
    for (let guard = 0; guard < 3000 && s.phase !== "laydown"; guard++) {
      if (s.phase === "play" && s.turn === 0) {
        s = gameReducer(s, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(s, 0) });
      } else {
        const tick = nextTick(s);
        if (!tick) throw new Error(`nothing to do in ${s.phase}`);
        s = gameReducer(s, tick.action);
      }
      expect(s.base).toBe(0);
      expect(s.scored).toBe(0);
      expect(s.pop).toBeNull();
      expect(econOf(s, 0).money).toBe(0);
    }
    expect(s.phase).toBe("laydown");
  });

  it("hands every card of the deal to the side that won it", () => {
    const s = toLaydown("CHALHANDS");
    const all = [...s.layHands[0], ...s.layHands[1]];
    expect(all).toHaveLength(52);
    expect(new Set(all.map((c) => c.uid)).size).toBe(52);
    expect(s.layHands[0]).toHaveLength(s.tricks[0] * 4);
    expect(s.layHands[1]).toHaveLength(s.tricks[1] * 4);
    expect(s.tricks[0] + s.tricks[1]).toBe(13);
    expect(s.table).toEqual([]);
    expect(s.layNo).toBe(0);
    expect(s.layPassed).toBe(0);
    expect(s.layScores).toEqual([0, 0]);
  });

  it("sorts both laydown hands by suit then rank", () => {
    const s = toLaydown("CHALSORT");
    for (const hand of s.layHands) {
      const order = hand.map((c) => [HAND_SUITS.indexOf(c.s), -c.r]);
      const sorted = order.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      expect(order).toEqual(sorted);
    }
  });

  /* The 6-7 case is the one an inverted boundary gets wrong: 7-6 leads with
     side 0 under both `>= 7` and `> 7`. */
  it.each([
    [7, 6, 0],
    [6, 7, 1],
  ])("gives the laydown to the side with %i tricks against %i", (us, them, turn) => {
    expect(laydownFrom(us, them).layTurn).toBe(turn);
  });
});

describe("the laydown's turn cycle", () => {
  /* A table nobody can extend and a hand that can lay one set, so the turn
     cycle can be driven by hand. */
  const setup = () => {
    const mine = [C("S", 9), C("H", 9), C("C", 9), C("D", 4)];
    const theirs = [C("S", 5), C("H", 5), C("C", 5), C("D", 2)];
    return layingDown({ layHands: [mine, theirs], layTurn: 0 });
  };

  /* The same, with opponents who cannot move: their turn is an aiLaydown that
     passes, which is the only way their turn is ever spent. layCards and
     passLaydown are the player's own dispatches and the reducer refuses them
     on the opponents' turn. */
  const stuck = () =>
    layingDown({
      layHands: [
        [C("S", 9), C("H", 9), C("C", 9), C("D", 4)],
        [C("D", 2), C("S", 7)],
      ],
      layTurn: 0,
    });

  it("flips the turn and clears the pass count after a lay", () => {
    const g = setup();
    const set = g.layHands[0].slice(0, 3).map((c) => c.uid);
    const after = gameReducer(g, { type: "layCards", p: 0, combos: [set] });

    expect(after.layTurn).toBe(1);
    expect(after.layNo).toBe(1);
    expect(after.layPassed).toBe(0);
    expect(after.layScores).toEqual([27, 0]);
    expect(after.layHands[0]).toHaveLength(1);
    expect(after.table.map((r) => r.map((c) => c.uid))).toEqual([set]);
    expect(after.phase).toBe("laydown");
  });

  it("counts a pass and keeps the laydown open", () => {
    const after = gameReducer(setup(), { type: "passLaydown", p: 0 });
    expect(after.layPassed).toBe(1);
    expect(after.layTurn).toBe(1);
    expect(after.phase).toBe("laydown");
  });

  it("ends the laydown on two passes in a row", () => {
    const g = gameReducer(stuck(), { type: "passLaydown", p: 0 });
    const after = gameReducer(g, { type: "aiLaydown" });
    expect(after.phase).toBe("handend");
    /* Nothing laid, four cards left: the score is allowed below zero. */
    expect(after.handScore).toBe(-4);
    expect(after.blindScore).toBe(-4);
    expect(after.dealsLeft).toBe(3);
  });

  /* The mutation this guards: leaving layPassed alone after a lay. Two lays
     in a row would then end the laydown. */
  it("does not end the laydown on a lay after a pass", () => {
    const g = gameReducer(setup(), { type: "passLaydown", p: 0 });
    expect(g.layTurn).toBe(1);
    /* The opponents hold three fives and lay them. */
    const after = gameReducer(g, { type: "aiLaydown" });
    expect(after.layScores[1]).toBe(15);
    expect(after.layPassed).toBe(0);
    expect(after.phase).toBe("laydown");
    const passed = gameReducer(after, { type: "passLaydown", p: 0 });
    expect(passed.phase).toBe("laydown");
    expect(passed.layPassed).toBe(1);
  });

  it("scores pips laid minus cards left, and does not clamp it", () => {
    const g = stuck();
    const set = g.layHands[0].slice(0, 3).map((c) => c.uid);
    let s = gameReducer(g, { type: "layCards", p: 0, combos: [set] });
    s = gameReducer(s, { type: "aiLaydown" });
    s = gameReducer(s, { type: "passLaydown", p: 0 });
    expect(s.phase).toBe("handend");
    /* 27 pips laid, one card left in hand. */
    expect(s.handScore).toBe(26);
  });

  /* The reducer re-runs validateLay rather than trusting the panel, so every
     refusal is reachable from a dispatch. */
  it("reaches every one of validateLay's six refusals through the reducer", () => {
    const g = setup();
    const mine = g.layHands[0];
    const run = [C("H", 3), C("H", 4), C("H", 5)];
    const rowUids = run.map((c) => c.uid);
    const six = C("H", 6);
    const seven = C("H", 7);
    const withTable = layingDown({ table: [run], layHands: [mine, []] });
    const extendable = layingDown({ table: [run], layHands: [[six, seven], []] });

    const refuse = (state: GameState, combos: string[][]) =>
      gameReducer(state, { type: "layCards", p: 0, combos }).toast?.key;

    expect(refuse(g, [["nosuchuid"]])).toBe("toast.layUnknownCard");
    expect(refuse(g, [[mine[0].uid, mine[1].uid, mine[2].uid, mine[0].uid]])).toBe(
      "toast.layDuplicate",
    );
    expect(refuse(withTable, [[mine[0].uid, mine[1].uid, mine[2].uid]])).toBe(
      "toast.layTableCardMissing",
    );
    expect(refuse(g, [[mine[0].uid, mine[1].uid, mine[3].uid]])).toBe("toast.layIllegalCombo");
    expect(refuse(extendable, [[...rowUids, six.uid, seven.uid]])).toBe("toast.layOneCard");
    expect(refuse(withTable, [rowUids])).toBe("toast.layNothing");
  });

  it("leaves the state alone when it refuses", () => {
    const g = setup();
    const after = gameReducer(g, { type: "layCards", p: 0, combos: [["nosuchuid"]] });
    expect(after.layNo).toBe(g.layNo);
    expect(after.layTurn).toBe(g.layTurn);
    expect(after.layHands[0]).toHaveLength(4);
    expect(after.table).toEqual([]);
  });

  it("passes for the opponents rather than throwing on a hand that cannot move", () => {
    const stuck = layingDown({
      layHands: [
        [C("S", 9), C("H", 9), C("C", 9)],
        [C("D", 2), C("S", 7)],
      ],
      layTurn: 1,
    });
    expect(chooseLaydown(stuck, 1)).toBeNull();
    const after = gameReducer(stuck, { type: "aiLaydown" });
    expect(after.layPassed).toBe(1);
    expect(after.layTurn).toBe(0);
  });

  /* An empty hand is not the same path as a hand that cannot move: the
     search runs out of pool rather than out of combinations, and on the
     player's side validateLay refuses for having laid nothing. */
  it("passes for a side whose hand is empty", () => {
    const theirs = layingDown({
      table: [[C("H", 3), C("H", 4), C("H", 5)]],
      layHands: [[C("S", 9)], []],
      layTurn: 1,
    });
    expect(chooseLaydown(theirs, 1)).toBeNull();
    const afterThem = gameReducer(theirs, { type: "aiLaydown" });
    expect(afterThem.layPassed).toBe(1);
    expect(afterThem.layTurn).toBe(0);
    expect(afterThem.phase).toBe("laydown");

    const table = [C("H", 3), C("H", 4), C("H", 5)];
    const mine = layingDown({ table: [table], layHands: [[], [C("S", 9)]], layTurn: 0 });
    expect(
      gameReducer(mine, { type: "layCards", p: 0, combos: [table.map((c) => c.uid)] }).toast?.key,
    ).toBe("toast.layNothing");
    const afterMe = gameReducer(mine, { type: "passLaydown", p: 0 });
    expect(afterMe.layPassed).toBe(1);
    expect(afterMe.layTurn).toBe(1);
  });

  /* The panel disables its footer on the opponents' turn, but the rule is
     the reducer's: a stray dispatch must not spend their turn or lay their
     cards. */
  it("ignores layCards and passLaydown on the opponents' turn", () => {
    const g = layingDown({
      layHands: [
        [C("S", 9), C("H", 9), C("C", 9)],
        [C("S", 5), C("H", 5), C("C", 5)],
      ],
      layTurn: 1,
    });
    const theirSet = g.layHands[1].map((c) => c.uid);

    const laid = gameReducer(g, { type: "layCards", p: 0, combos: [theirSet] });
    expect(laid.table).toEqual([]);
    expect(laid.layScores).toEqual([0, 0]);
    expect(laid.layHands[1]).toHaveLength(3);
    expect(laid.layNo).toBe(0);
    expect(laid.layTurn).toBe(1);

    const passed = gameReducer(g, { type: "passLaydown", p: 0 });
    expect(passed.layPassed).toBe(0);
    expect(passed.layNo).toBe(0);
    expect(passed.layTurn).toBe(1);
  });
});

describe("the opponents' laydown search", () => {
  it("extends a run on the table with a card it holds", () => {
    const run = [C("H", 3), C("H", 4), C("H", 5)];
    const g = layingDown({
      table: [run],
      layHands: [[], [C("H", 6), C("D", 2)]],
      layTurn: 1,
    });
    const after = gameReducer(g, { type: "aiLaydown" });
    expect(after.table[0].map((c) => c.uid).sort()).toEqual(
      [...run, g.layHands[1][0]].map((c) => c.uid).sort(),
    );
    expect(after.layScores[1]).toBe(6);
  });

  it("lays a fresh set", () => {
    const g = layingDown({
      table: [],
      layHands: [[], [C("S", 12), C("H", 12), C("C", 12), C("D", 2)]],
      layTurn: 1,
    });
    const after = gameReducer(g, { type: "aiLaydown" });
    expect(after.layScores[1]).toBe(36);
    expect(after.table).toHaveLength(1);
    expect(after.layHands[1]).toHaveLength(1);
  });

  it("only ever proposes legal combinations, over twenty seeded runs", () => {
    for (let i = 0; i < 20; i++) {
      const r = playChallenge(`CHALAI${i}`);
      for (const row of r.state.table) expect(comboOk(row)).toBe(true);
    }
  });
});

describe("a whole challenge run", () => {
  it("settles over twenty seeded runs and totals its four deals", () => {
    for (let i = 0; i < 20; i++) {
      const r = playChallenge(`CHALRUN${i}`);
      expect(r.deals).toHaveLength(4);
      expect(r.state.screen).toEqual({ kind: "challengeover", score: r.score });
      expect(r.state.runScore).toBe(r.score);
      expect(r.deals.reduce((a, b) => a + b, 0)).toBe(r.score);
      expect(econOf(r.state, 0).money).toBe(0);
      expect(r.state.base).toBe(0);
      expect(r.state.pop).toBeNull();
    }
  });

  it("opens a deal-end screen while deals remain and challengeover at the last", () => {
    const r = playChallenge("CHALEND");
    expect(r.state.dealsLeft).toBe(0);
    expect(r.state.blindScore).toBe(r.score);
  });
});

describe("leaving a challenge", () => {
  it("gives the parked run back exactly", () => {
    const mid = playToScreen(advance(gameReducer(createRun("PARKED"), { type: "startBlind" })));
    const running = { ...mid, runStarted: true };
    const chal = advance(gameReducer(running, { type: "startChallenge", id: "rummikub" }));
    const played = playChallenge("PARKED2").state;
    /* Finish a challenge from the parked state, then leave it. */
    const finished = { ...played, parked: chal.parked };
    const back = gameReducer(finished, { type: "leaveChallenge" });

    expect(back.challenge).toBeNull();
    expect(back.menu).toBe("start");
    expect(back.seed).toBe(running.seed);
    expect(econOf(back, 0).jokers).toEqual(econOf(running, 0).jokers);
    expect(econOf(back, 0).consumables).toEqual(econOf(running, 0).consumables);
    expect(back.boss).toBe(running.boss);
    expect(econOf(back, 0).shop).toEqual(econOf(running, 0).shop);
    expect(back.hands).toEqual(running.hands);
    expect(back.rngState).toBe(running.rngState);
    expect(back.blindScore).toBe(running.blindScore);
  });

  it("falls back to a fresh unstarted run when there is nothing parked", () => {
    const chal = advance(
      gameReducer(createRun("NOPARK"), { type: "startChallenge", id: "rummikub" }),
    );
    const back = gameReducer({ ...chal, parked: null }, { type: "leaveChallenge" });
    expect(back.challenge).toBeNull();
    expect(back.menu).toBe("start");
    expect(back.runStarted).toBe(false);
    expect(back.screen).toEqual({ kind: "blindselect" });
  });

  it("carries the parked run across a Play again rather than losing it", () => {
    const running = { ...createRun("MAINRUN"), runStarted: true };
    const first = advance(gameReducer(running, { type: "startChallenge", id: "rummikub" }));
    const again = gameReducer(first, { type: "startChallenge", id: "rummikub" });
    expect(again.parked?.seed).toBe("MAINRUN");
    expect(gameReducer(again, { type: "leaveChallenge" }).seed).toBe("MAINRUN");
  });
});

describe("the laydown on the clock", () => {
  it("ticks for the opponents and waits for the player", () => {
    const mine = layingDown({ layTurn: 0 });
    expect(nextTick(mine)).toBeNull();
    const theirs = layingDown({ layTurn: 1, layNo: 3 });
    expect(nextTick(theirs)).toEqual({
      key: "lay:3",
      action: { type: "aiLaydown" },
      delay: 900,
    });
  });
});

/* ==================== the race ====================
   A second alternate rule set, and the first one that seats more than one
   human. What is asserted here is the flow: what startChallenge builds, that a
   race deal is ordinary tuppi, that the tricks score for both pairs and pay
   nobody, and that endHand banks a match rather than a blind. */
describe("starting a race", () => {
  const startRace = (seed = "RACE1", over: StateOver = {}, seats?: GameState["seats"]) =>
    advance(
      gameReducer(withOver(createRun(seed), over), {
        type: "startChallenge",
        id: "race",
        ...(seats === undefined ? {} : { seats }),
      }),
    );

  it("drops the whole roguelike shell and keeps the match target", () => {
    const g = startRace("RACE1", {
      money: 42,
      jokers: [JOKERS[0], JOKERS[1]],
      consumables: [CONSUMABLES[0]],
      vouchers: [VOUCHERS[0].id],
      sideDeck: [C("S", 14, "wild")],
      boss: SMALL_BOSSES[0],
      target: 5000,
      runStarted: true,
    });

    expect(g.challenge).toBe("race");
    expect(g.runStarted).toBe(true);
    expect(g.menu).toBeNull();
    expect(g.screen).toBeNull();
    expect(g.boss).toBeNull();
    expect(g.target).toBe(RACE_TARGET);
    expect(g.raceDeal).toBe(1);
    expect(g.raceScores).toEqual([0, 0]);
    expect(g.deals).toBe(0);
    expect(g.blindDeals).toBe(0);
    expect(g.dealsLeft).toBe(0);
    for (const p of [0, 1, 2, 3] as Seat[]) {
      const e = econOf(g, p);
      expect(e.money).toBe(0);
      expect(e.jokers).toEqual([]);
      expect(e.consumables).toEqual([]);
      expect(e.vouchers).toEqual([]);
      expect(e.sideDeck).toEqual([]);
    }
    /* Dealt already, and into an ordinary declaration rather than a swap or a
       forced rami. */
    expect(g.phase).toBe("declare");
    expect(g.mode).toBeNull();
    expect(g.hands[0]).toHaveLength(13);
  });

  it("parks the main run whole", () => {
    const running = { ...createRun("MAINRACE"), runStarted: true };
    const g = advance(gameReducer(running, { type: "startChallenge", id: "race" }));
    expect(g.parked?.seed).toBe("MAINRACE");
    expect(gameReducer(g, { type: "leaveChallenge" }).seed).toBe("MAINRACE");
  });

  /* A race started from inside the rummikub challenge must carry the park
     across rather than dehydrating the challenge, which would drop it. */
  it("carries the park across from another challenge", () => {
    const running = { ...createRun("MAINBOTH"), runStarted: true };
    const chal = advance(gameReducer(running, { type: "startChallenge", id: "rummikub" }));
    const race = gameReducer(chal, { type: "startChallenge", id: "race" });
    expect(race.parked?.seed).toBe("MAINBOTH");
    expect(gameReducer(race, { type: "leaveChallenge" }).seed).toBe("MAINBOTH");
  });

  it("seats one human by default", () => {
    expect(startRace().seats).toEqual(["human", "ai", "ai", "ai"]);
  });

  /* The table the lobby's chairs picked, taken whole and in order. Seats 0 and
     2 are the same pair, which the clockwise seating this replaced could not
     reach: two people can now be partners as well as opponents. */
  it("takes a table of two partners verbatim", () => {
    const table: GameState["seats"] = ["human", "ai", "human", "ai"];
    const g = startRace("RACEPAIR", {}, table);
    expect(g.seats).toEqual(table);
    expect(teamOf(0)).toBe(teamOf(2));
    expect(waitingSeat(g)).not.toBeNull();
  });

  it("takes a table of two opponents verbatim", () => {
    const g = startRace("RACE2", {}, ["human", "human", "ai", "ai"]);
    expect(g.seats).toEqual(["human", "human", "ai", "ai"]);
    expect(teamOf(0)).not.toBe(teamOf(1));
  });

  it("leaves no AI seat with a table of four humans", () => {
    expect(startRace("RACE3", {}, ["human", "human", "human", "human"]).seats).toEqual([
      "human",
      "human",
      "human",
      "human",
    ]);
  });

  /* An all-AI board is expressible in the type now, and nextTick would stall
     on it at the first player-gated phase. The guard is the reducer's: one
     human in the chair the parked run was played in, which is *not* seat 0 —
     a fallback hardcoded to 0 would pass at seat 0 and strand this run. */
  it("refuses an all-AI table and seats the owner's own chair instead", () => {
    const g = advance(
      gameReducer(createRun("RACEALLAI", 0, 2), {
        type: "startChallenge",
        id: "race",
        seats: ["ai", "ai", "ai", "ai"],
      }),
    );
    expect(g.seats).toEqual(["ai", "ai", "human", "ai"]);
    expect(ownerSeat(g)).toBe(2);
    expect(waitingSeat(g)).not.toBeNull();
  });

  /* The regression guard for the whole change: a challenge dispatched with no
     table at all is the single-human board it has always been, field for
     field, and not the all-AI one the missing fallback would give. */
  it("builds the same board with no table as with the single-human one", () => {
    /* The seed is explicit on both: omitted, the reducer draws a fresh one and
       the two boards would differ in every card for a reason this test is not
       about. */
    const bare = gameReducer(createRun("RACEBARE"), {
      type: "startChallenge",
      id: "rummikub",
      seed: "RACEBARE",
    });
    const named = gameReducer(createRun("RACEBARE"), {
      type: "startChallenge",
      id: "rummikub",
      seed: "RACEBARE",
      seats: ["human", "ai", "ai", "ai"],
    });
    expect(bare.seats).toEqual(["human", "ai", "ai", "ai"]);
    expect(bare).toEqual(named);
    expect(bare.challenge).toBe("rummikub");
    expect(bare.deals).toBe(4);
    expect(bare.blindDeals).toBe(4);
    expect(bare.dealsLeft).toBe(4);
    expect(bare.target).toBe(0);
  });
});

describe("a race deal is ordinary tuppi with no shell", () => {
  /* Every seat AI, so `advance` walks the whole deal with no decision to
     make: the declaration, the tricks and the hand's end all come from the
     clock. A race started this way is not reachable in the UI — the reducer
     refuses an all-AI table — but it is the state that makes a whole deal
     observable. */
  const dealt = (seed: string): GameState => {
    const g = gameReducer(createRun(seed), { type: "startChallenge", id: "race" });
    return { ...g, seats: ["ai", "ai", "ai", "ai"] };
  };

  /* Stepped rather than advanced, so every phase on the way is recorded: an
     `advance` first would leave only the last one. */
  const walk = (seed: string) => {
    let s = dealt(seed);
    const seen = new Set<GameState["phase"]>([s.phase]);
    for (let guard = 0; guard < 4000 && !s.screen; guard++) {
      const tick = nextTick(s);
      if (!tick) break;
      s = gameReducer(s, tick.action);
      seen.add(s.phase);
    }
    return { s, seen };
  };

  it("visits only the phases a tuppi deal has, and never swap or laydown", () => {
    const { s, seen } = walk("RACEPHASE");
    expect(s.screen?.kind).toBe("dealend");
    for (const phase of ["declare", "play", "resolve", "trickend", "handend"] as const)
      expect(seen).toContain(phase);
    for (const phase of ["swap", "laydown", "shop", "blindselect"] as const)
      expect(seen).not.toContain(phase);
    expect(s.table).toEqual([]);
    expect(s.layHands).toEqual([[], []]);
  });

  it("scores its tricks for both pairs and pays nobody", () => {
    const { s } = walk("RACEPAY");
    expect(s.raceBase[0] + s.raceBase[1]).toBeGreaterThan(0);
    for (const p of [0, 1, 2, 3] as Seat[]) expect(econOf(s, p).money).toBe(0);
    /* base and scored belong to the main game's one-sided accounting and stay
       where startDeal left them. */
    expect(s.base).toBe(0);
    expect(s.scored).toBe(0);
  });

  /* The declaration is real, so a sooli offer is reachable — which is what
     makes the mode ordinary tuppi rather than a forced rami. */
  it("offers a sooli to a human defender", () => {
    const offered = Array.from({ length: 40 }, (_, i) => {
      /* The one human seat has to make its own declaration before the round
         can finish; nolo leaves the rami to an opponent, which is what puts
         the offer on the table. */
      const g = advance(
        gameReducer(createRun(`RACESOOLI${i}`), { type: "startChallenge", id: "race" }),
      );
      return g.phase === "declare" ? act(g, { type: "declare", p: 0, decl: "nolo" }) : g;
    }).filter((g) => g.phase === "soolioffer");
    expect(offered.length).toBeGreaterThan(0);

    const seat = offered[0].sooliSeat;
    expect(seat).not.toBeNull();
    const taken = act(offered[0], { type: "acceptSooli", p: seat as Seat });
    expect(taken.sooli).toBe(true);
    expect(taken.phase).toBe("sooligive");
  });
});

/* ==================== whose wallet a race trick banks from ====================
   resolveTrick's race branch scores every trick twice, once per pair, and each
   call has to be given *that pair's own* seat — seatOfTeam(t) — rather than the
   run owner's or the trick winner's. Every wallet in a race is empty, so a
   wrong seat gives the right number by accident and nothing else in the suite
   can see it: race.test.ts guards dealScores, which is a different call site,
   and the golden in seats.test.ts holds four indistinguishable purses.

   So this drives the reducer's own branch with exactly one non-empty wallet,
   and it is deliberately the *non-owner's* pair's: the deal is a nolo the run
   owner's side won, so the pair that scores the trick is team 1, whose own seat
   is neither the winner (seat 0) nor the owner (seat 0). */
describe("a race trick banks from the scoring pair's own wallet", () => {
  const jokerBy = (id: string) => {
    const j = JOKERS.find((x) => x.id === id);
    if (!j) throw new Error("no such joker: " + id);
    return j;
  };

  /* Four suits, four ranks: a high-card trick, chips 15 and mult 1, so the
     arithmetic below is exact with no rounding of its own. Seat 0 leads the
     only spade and takes it. */
  const trick: GameState["trick"] = [
    { p: 0, card: C("S", 14) },
    { p: 1, card: C("H", 5) },
    { p: 2, card: C("D", 7) },
    { p: 3, card: C("C", 9) },
  ];
  const resolve = (g: GameState) =>
    gameReducer({ ...g, phase: "resolve", leader: 0, turn: 0, mode: "nolo", trick }, {
      type: "resolveTrick",
    } as Action);

  const bare = gameReducer(createRun("RACEWALLET"), { type: "startChallenge", id: "race" });
  /* nolomestari fires on any nolo trick (+6 mult) and the chip bonus is per
     card, so a wallet of 4 adds 16 chips across the four of them. */
  const loaded = { jokers: [jokerBy("nolomestari")], chipBonus: 4 };
  const scoringSeat = withEcon(bare, 1, loaded);
  /* Every seat *except* the scoring pair's own: the winner, the run owner and
     the scoring pair's partner all hold the same purse, and none of them may
     reach the number team 1 banks. */
  const everyOtherSeat = ([0, 2, 3] as const).reduce((g, p) => withEcon(g, p, loaded), bare);

  it("scores the pair that dodged the trick and not the pair that won it", () => {
    const s = resolve(bare);
    expect(s.raceBase[0]).toBe(0);
    expect(s.raceBase[1]).toBeGreaterThan(0);
  });

  it("reads the scoring pair's own jokers and chip bonus", () => {
    const base = resolve(bare).raceBase[1];
    expect(resolve(scoringSeat).raceBase[1]).toBe((base + 16) * 7);
    expect(resolve(scoringSeat).raceBase[0]).toBe(0);
  });

  it("reads no other seat's wallet, the winner's and the owner's included", () => {
    expect(resolve(everyOtherSeat).raceBase).toEqual(resolve(bare).raceBase);
  });
});

describe("endHand in a race banks the match, not a blind", () => {
  /* The two deals are driven all the way through the clock, so what is read
     is what the reducer actually did rather than a hand-made state. */
  const twoDeals = (seed: string) => {
    const first = (() => {
      let s = advance({
        ...gameReducer(createRun(seed), { type: "startChallenge", id: "race" }),
        seats: ["ai", "ai", "ai", "ai"] as GameState["seats"],
      });
      for (let guard = 0; guard < 4000 && !s.screen; guard++) {
        const tick = nextTick(s);
        if (!tick) break;
        s = gameReducer(s, tick.action);
      }
      return s;
    })();
    return [first, advance(gameReducer(first, { type: "nextDeal" }))] as const;
  };

  it("leaves dealsLeft and blindScore alone across two deals", () => {
    const [first, second] = twoDeals("RACEBANK");
    expect(first.dealsLeft).toBe(0);
    expect(first.blindScore).toBe(0);
    expect(second.dealsLeft).toBe(0);
    expect(second.blindScore).toBe(0);
    /* And the run's other shell counters are exactly where startChallenge
       left them. */
    expect(second.deals).toBe(0);
    expect(second.blindDeals).toBe(0);
    expect(second.ante).toBe(1);
    expect(second.blindIdx).toBe(0);
    expect(second.beaten).toEqual([false, false, false, false]);
    expect(second.boss).toBeNull();
  });

  it("adds each deal's per-pair score to the match total and counts the deal", () => {
    const [first] = twoDeals("RACEBANK2");
    expect(first.raceDeal).toBe(1);
    expect(first.raceScores).toEqual(dealScores(first));
    expect(first.handScore).toBe(first.raceScores[ownerTeam(first)]);

    /* Read before the clock plays the second deal: `advance` would leave
       raceBase holding that deal's own tricks. */
    const started = gameReducer(first, { type: "nextDeal" });
    expect(started.raceDeal).toBe(2);
    expect(started.raceBase).toEqual([0, 0]);
    /* The first deal's totals are still banked, untouched by the new deal. */
    expect(started.raceScores).toEqual(first.raceScores);
  });
});

describe("showHandResult in a race always opens a screen", () => {
  const atHandEnd = (over: StateOver = {}): GameState =>
    withOver(createRun("RACEEND"), {
      challenge: "race",
      phase: "handend",
      screen: null,
      menu: null,
      target: RACE_TARGET,
      raceDeal: 3,
      handScore: 1234,
      ...over,
    });

  /* nextTick's handend case returns a tick whenever the screen is null, so a
     branch that opened none would fire showHandResult forever. */
  it("gives exactly one showHandResult tick and none after it", () => {
    const g = atHandEnd({ raceScores: [4000, 3000] });
    const tick = nextTick(g);
    expect(tick?.action).toEqual({ type: "showHandResult" });
    const after = gameReducer(g, { type: "showHandResult" });
    expect(after.screen).toEqual({ kind: "dealend", score: 1234 });
    expect(nextTick(after)).toBeNull();
  });

  it("opens raceover once a pair is at the target, with both totals", () => {
    const g = atHandEnd({ raceScores: [RACE_TARGET + 500, 3000] });
    const after = gameReducer(g, { type: "showHandResult" });
    expect(after.screen).toEqual({
      kind: "raceover",
      winner: 0,
      scores: [RACE_TARGET + 500, 3000],
      deals: 3,
    });
    expect(after.runScore).toBe(RACE_TARGET + 500);
    expect(nextTick(after)).toBeNull();
  });

  it("names the other pair when it is the one across the line", () => {
    const g = atHandEnd({ raceScores: [3000, RACE_TARGET] });
    const after = gameReducer(g, { type: "showHandResult" });
    expect(after.screen).toMatchObject({ kind: "raceover", winner: 1 });
    /* runScore is the run owner's pair's, win or lose. */
    expect(after.runScore).toBe(3000);
  });
});

/* ==================== the traditional match ====================
   Same thirteen tricks as a race and a different scale entirely: no chips, no
   score pop, and a deal worth tuppi's own points. What these hold is that the
   two arithmetics never leak into each other. */
describe("a traditional deal plays like a race and scores no chips", () => {
  /* Every seat AI, so `advance` and the clock walk the whole deal with no
     decision to make — the same shape the race's own walk uses. */
  const walk = (seed: string) => {
    let s: GameState = {
      ...gameReducer(createRun(seed), { type: "startChallenge", id: "tuppi" }),
      seats: ["ai", "ai", "ai", "ai"],
    };
    const seen = new Set<GameState["phase"]>([s.phase]);
    for (let guard = 0; guard < 4000 && !s.screen; guard++) {
      const tick = nextTick(s);
      if (!tick) break;
      s = gameReducer(s, tick.action);
      seen.add(s.phase);
    }
    return { s, seen };
  };

  it("takes the target off the CHALLENGES row and keeps none of the shell", () => {
    const g = gameReducer(createRun("TRADSTART"), { type: "startChallenge", id: "tuppi" });
    expect(g.challenge).toBe("tuppi");
    expect(g.target).toBe(TUPPI_TARGET);
    expect(g.deals).toBe(0);
    expect(g.dealsLeft).toBe(0);
    expect(g.raceDeal).toBe(1);
    expect(g.raceScores).toEqual([0, 0]);
    expect(g.boss).toBeNull();
    for (const p of [0, 1, 2, 3] as Seat[]) {
      expect(econOf(g, p).money).toBe(0);
      expect(econOf(g, p).jokers).toEqual([]);
      expect(econOf(g, p).sideDeck).toEqual([]);
    }
  });

  it("visits only the phases a tuppi deal has, and never swap or laydown", () => {
    const { s, seen } = walk("TRADPHASE");
    expect(s.screen?.kind).toBe("dealend");
    for (const phase of ["declare", "play", "resolve", "trickend", "handend"] as const)
      expect(seen).toContain(phase);
    for (const phase of ["swap", "laydown", "shop", "blindselect"] as const)
      expect(seen).not.toContain(phase);
  });

  /* The whole of the mode's resolveTrick arm: no scoreTrick, so no chips into
     raceBase, no money and no score pop for a felt that has nothing to pop. */
  it("banks no chips, pays nobody and shows no score pop", () => {
    const { s } = walk("TRADCHIPS");
    expect(s.raceBase).toEqual([0, 0]);
    expect(s.base).toBe(0);
    expect(s.scored).toBe(0);
    expect(s.pop).toBeNull();
    for (const p of [0, 1, 2, 3] as Seat[]) expect(econOf(s, p).money).toBe(0);
  });

  /* Party support is the one tally every mode keeps: it is counted above the
     id branches, so the traditional arm must not have taken it with it. */
  it("still tallies party support", () => {
    const { s } = walk("TRADPARTY");
    expect(Object.values(s.support).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it("banks exactly dealPoints, and never dealScores", () => {
    const { s } = walk("TRADBANK");
    expect(s.raceScores).toEqual(dealPoints(s));
    expect(s.handScore).toBe(s.raceScores[ownerTeam(s)]);
    /* dealScores over the same state is the race's arithmetic, and with an
       empty raceBase it is zero — which is exactly the wrong answer to bank
       and the one a conflated branch would have given. */
    expect(dealScores(s)).toEqual([0, 0]);
    expect(s.raceScores).not.toEqual([0, 0]);
    expect(s.dealsLeft).toBe(0);
    expect(s.blindScore).toBe(0);
  });
});

/* Both sooli outcomes, on a state where ramTeam and the soloist's team are
   deliberately *different* pairs: a fixture where they coincide proves nothing
   about which of the two the busted branch reads. */
describe("endHand in a traditional match scores a sooli by tuppi's table", () => {
  const played = (over: StateOver): GameState =>
    withOver(createRun("TRADSOOLI"), {
      challenge: "tuppi",
      phase: "trickend",
      screen: null,
      menu: null,
      target: TUPPI_TARGET,
      raceDeal: 1,
      raceScores: [0, 0],
      sooli: true,
      mode: "rami",
      ramTeam: 0,
      sooliSeat: 1,
      trickNo: 13,
      seats: ["ai", "ai", "ai", "ai"],
      ...over,
    });

  it("pays the soloist's pair 24 when the sooli holds", () => {
    const s = gameReducer(played({ sooliBust: false, tricks: [13, 0] }), { type: "endTrick" });
    expect(s.phase).toBe("handend");
    expect(s.raceScores).toEqual([0, 24]);
  });

  /* The deliberate disagreement: a race scores a busted sooli for nobody and
     this mode pays the declaring pair 24, which is the source's rule. */
  it("pays the declaring pair 24 when the sooli busts, where a race pays nobody", () => {
    const g = played({ sooliBust: true, tricks: [12, 1] });
    expect(gameReducer(g, { type: "endTrick" }).raceScores).toEqual([24, 0]);
    expect(dealScores({ ...g, raceBase: [4000, 4000] })).toEqual([0, 0]);
  });
});

describe("traditional match points reset when the pair up loses", () => {
  const cases: Array<[string, StateOver, number]> = [
    ["rami", { mode: "rami", ramTeam: 0, tricks: [10, 3] }, 16],
    ["ryosto", { mode: "rami", ramTeam: 1, tricks: [13, 0] }, 56],
    ["nolo", { mode: "nolo", ramTeam: null, tricks: [3, 10] }, 16],
    ["held sooli", { mode: "rami", ramTeam: 1, tricks: [0, 13], sooli: true, sooliSeat: 0 }, 24],
    [
      "busted sooli",
      { mode: "rami", ramTeam: 0, tricks: [12, 1], sooli: true, sooliSeat: 1, sooliBust: true },
      24,
    ],
  ];
  const played = (over: StateOver): GameState =>
    withOver(createRun("RESET"), {
      challenge: "tuppi",
      target: TUPPI_TARGET,
      raceDeal: 1,
      phase: "trickend",
      screen: null,
      menu: null,
      trickNo: 12,
      handScore: 32,
      ...over,
    });

  describe.each([0, 1] as const)("winning team %i", (winner) => {
    const pair = (a: number, b: number): [number, number] => (winner === 0 ? [a, b] : [b, a]);
    const rotate = (over: StateOver): StateOver => ({
      ...over,
      tricks: pair(...over.tricks!),
      ramTeam: over.ramTeam === null ? null : (((over.ramTeam! + winner) % 2) as 0 | 1),
      sooliSeat:
        over.sooliSeat === undefined || over.sooliSeat === null
          ? null
          : (((over.sooliSeat + winner) % 2) as Seat),
    });

    it.each(cases)("banks %s from the table and extends a winning rise", (_name, over, points) => {
      for (const previous of [0, 12]) {
        const g = played({ ...rotate(over), raceScores: pair(previous, 0) });
        const s = act(g, { type: "endTrick" });
        expect(s.raceScores).toEqual(pair(previous + points, 0));
        expect(s.handScore).toBe(winner === 0 ? points : 0);
        expect(s.screen?.kind).toBe(previous + points >= TUPPI_TARGET ? "raceover" : "dealend");
      }
    });

    it.each(cases)(
      "%s knocks a lead down without banking the winning deal",
      (_name, over, points) => {
        const g = played({ ...rotate(over), raceScores: pair(0, 48) });
        expect(dealPoints(g)).toEqual(pair(points, 0));
        const s = act(g, { type: "endTrick" });
        expect(s.raceScores).toEqual([0, 0]);
        expect(s.handScore).toBe(0);
        /* Even a 56-point ryosto only knocks this lead down, not into raceover. */
        expect(s.screen).toEqual({ kind: "dealend", score: 0 });
        expect(nextTick(s)).toBeNull();
        expect(gameReducer(s, { type: "endTrick" })).toEqual(s);

        const next = gameReducer(s, { type: "nextDeal" });
        expect(next.raceScores).toEqual([0, 0]);
        expect(next.raceDeal).toBe(2);
        const wonAgain = act(
          withOver(next, {
            ...rotate(over),
            phase: "trickend",
            screen: null,
            trickNo: 12,
          }),
          { type: "endTrick" },
        );
        expect(wonAgain.raceScores).toEqual(pair(points, 0));
      },
    );
  });

  it("reaches exactly 52 on a continuing rise", () => {
    const s = act(played({ mode: "rami", ramTeam: 0, tricks: [7, 6], raceScores: [48, 0] }), {
      type: "endTrick",
    });
    expect(s.raceScores).toEqual([52, 0]);
    expect(s.screen).toMatchObject({ kind: "raceover", winner: 0, scores: [52, 0] });
  });

  it("leaves the race's independent cumulative scores alone", () => {
    const g = played({
      challenge: "race",
      target: RACE_TARGET,
      mode: "rami",
      ramTeam: 0,
      tricks: [6, 7],
      raceScores: [2000, 3000],
      raceBase: [100, 200],
    });
    const points = dealScores(g);
    expect(points[1]).toBeGreaterThan(0);
    const s = act(g, { type: "endTrick" });
    expect(s.raceScores).toEqual([2000, 3000 + points[1]]);
  });
});

describe("showHandResult in a traditional match always opens a screen", () => {
  const atHandEnd = (over: StateOver = {}): GameState =>
    withOver(createRun("TRADEND"), {
      challenge: "tuppi",
      phase: "handend",
      screen: null,
      menu: null,
      target: TUPPI_TARGET,
      raceDeal: 5,
      handScore: 16,
      ...over,
    });

  it("gives exactly one showHandResult tick and none after it", () => {
    const g = atHandEnd({ raceScores: [20, 0] });
    expect(nextTick(g)?.action).toEqual({ type: "showHandResult" });
    const after = gameReducer(g, { type: "showHandResult" });
    expect(after.screen).toEqual({ kind: "dealend", score: 16 });
    expect(nextTick(after)).toBeNull();
  });

  it("opens raceover once a pair is at 52, with both totals", () => {
    const g = atHandEnd({ raceScores: [TUPPI_TARGET + 4, 0] });
    const after = gameReducer(g, { type: "showHandResult" });
    expect(after.screen).toEqual({
      kind: "raceover",
      winner: 0,
      scores: [TUPPI_TARGET + 4, 0],
      deals: 5,
    });
    expect(after.runScore).toBe(TUPPI_TARGET + 4);
    expect(nextTick(after)).toBeNull();
  });

  /* advance throws "advance: did not settle" on a handend that opens no
     screen, which is the loop nextTick warns about. It is the headless
     driver's job because React's dep-keyed effect hides it. */
  it.each([
    ["short of the target", [20, 0] as [number, number]],
    ["across the target", [TUPPI_TARGET, 0] as [number, number]],
  ])("settles under advance %s", (_label, raceScores) => {
    const s = advance(atHandEnd({ raceScores }));
    expect(s.screen).not.toBeNull();
  });
});

/* The seat the game is waiting on, which is what makes a hot seat work. */
describe("waitingSeat", () => {
  const at = (over: StateOver): GameState => withOver(createRun("WAIT"), { screen: null, ...over });

  it.each([
    ["declare", { phase: "declare", declSeq: [1, 2, 3, 0], declIdx: 0 } as StateOver, 1],
    ["play", { phase: "play", turn: 2 } as StateOver, 2],
    ["soolioffer", { phase: "soolioffer", sooliSeat: 3 } as StateOver, 3],
    ["sooligive", { phase: "sooligive", sooliSeat: 3 } as StateOver, 3],
    ["sooliready", { phase: "sooliready", sooliSeat: 3 } as StateOver, 3],
    ["swap", { phase: "swap" } as StateOver, 0],
    ["laydown", { phase: "laydown", layTurn: 1 } as StateOver, 1],
  ])("names the acting seat in the %s phase", (_label, over, want) => {
    const g = at({ ...over, seats: ["human", "human", "human", "human"] });
    expect(waitingSeat(g)).toBe(want);
  });

  it("returns each of the four seats for a board seated accordingly", () => {
    for (const p of [0, 1, 2, 3] as Seat[]) {
      const seats = ["ai", "ai", "ai", "ai"] as GameState["seats"];
      seats[p] = "human";
      expect(waitingSeat(at({ phase: "play", turn: p, seats }))).toBe(p);
    }
  });

  /* A team is a seat and its partner, and either of them being human makes
     the laydown turn a decision. */
  it("finds the human partner of an AI seat in the laydown", () => {
    const g = at({ phase: "laydown", layTurn: 0, seats: ["ai", "ai", "human", "ai"] });
    expect(waitingSeat(g)).toBe(2);
  });

  it.each([
    ["a menu", { phase: "play", turn: 0, menu: "start" } as StateOver],
    ["a screen", { phase: "play", turn: 0, screen: { kind: "dealend", score: 1 } } as StateOver],
    ["an automatic phase", { phase: "resolve" } as StateOver],
    [
      "a finished declaration",
      { phase: "declare", declSeq: [1, 2, 3, 0], declIdx: 4 } as StateOver,
    ],
    ["an AI seat", { phase: "play", turn: 0, seats: ["ai", "ai", "ai", "ai"] } as StateOver],
  ])("returns null under %s", (_label, over) => {
    expect(waitingSeat(at(over))).toBeNull();
  });

  /* The two halves of the same question. One direction holds everywhere: a
     phase waiting for a person has no tick, or the clock would play over the
     top of them. Every phase a race visits, both sooli branches included. */
  const PHASE_CASES: Array<[string, StateOver]> = [
    ["declare", { phase: "declare", declSeq: [1, 2, 3, 0], declIdx: 0 }],
    ["play", { phase: "play", turn: 2 }],
    ["soolioffer", { phase: "soolioffer", sooliSeat: 3 }],
    ["sooligive", { phase: "sooligive", sooliSeat: 3 }],
    ["sooliready", { phase: "sooliready", sooliSeat: 3 }],
    ["swap", { phase: "swap" }],
    ["laydown", { phase: "laydown", layTurn: 1 }],
    ["resolve", { phase: "resolve" }],
    ["trickend", { phase: "trickend" }],
    ["handend", { phase: "handend" }],
  ];

  it.each(PHASE_CASES)("never names a seat the clock would play over in %s", (_label, over) => {
    for (const seats of [
      ["human", "human", "human", "human"],
      ["ai", "ai", "ai", "ai"],
    ] as GameState["seats"][]) {
      const g = at({ ...over, seats });
      if (waitingSeat(g) !== null) expect(nextTick(g), `${g.phase} ${seats.join()}`).toBeNull();
    }
  });

  /* The other direction holds for exactly the three phases nextTick gates on
     a seat's kind — declare, play and laydown. The three sooli phases and the
     swap have no tick at all, so an all-AI board stalls in them: that is why
     startChallenge refuses an all-AI table and seats one human instead. */
  it.each(PHASE_CASES.filter(([label]) => ["declare", "play", "laydown"].includes(label)))(
    "answers exactly where nextTick declines to, in %s",
    (_label, over) => {
      const humans = at({ ...over, seats: ["human", "human", "human", "human"] });
      const ai = at({ ...over, seats: ["ai", "ai", "ai", "ai"] });
      expect(waitingSeat(humans)).not.toBeNull();
      expect(nextTick(humans)).toBeNull();
      expect(waitingSeat(ai)).toBeNull();
      expect(nextTick(ai)).not.toBeNull();
    },
  );

  it.each(
    PHASE_CASES.filter(([label]) =>
      ["soolioffer", "sooligive", "sooliready", "swap"].includes(label),
    ),
  )("has no tick to fall back on in %s, so an all-AI board stalls there", (_label, over) => {
    const ai = at({ ...over, seats: ["ai", "ai", "ai", "ai"] });
    expect(waitingSeat(ai)).toBeNull();
    expect(nextTick(ai)).toBeNull();
  });
});
