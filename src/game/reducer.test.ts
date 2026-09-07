/* The flow. Phases are data and the bot plays through them, so a whole deal
   can be tested without a browser and without a timer. */
import { describe, expect, it } from "vitest";
import { act, advance } from "./drive";
import { gameReducer } from "./reducer";
import { anySwapAvailable, legalCards, trickSize } from "./rules";
import { createRun } from "./state";
import { makeRng, seedHash } from "./rng";
import { rollCardOffer } from "./shop";
import { ANTES, SUITS } from "./constants";
import { BIG_BOSSES, CONSUMABLES, JOKERS, PARTY_IDS, SMALL_BOSSES, VOUCHERS } from "./content";
import { chooseLaydown } from "./ai";
import { comboOk } from "./laydown";
import { nextTick } from "./schedule";
import { basicPolicy, playBlind, playChallenge, playRun, playToScreen } from "../test/bot";
import { card as C } from "../test/factories";
import type { GameState, Mode, Seat, ShopItem, Suit } from "./types";

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
    expect(g.usTricks + g.themTricks).toBe(13);
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
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", decl: "rami" }) : advance(g);
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
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", decl: "nolo" }) : advance(g);
    }
    expect(g.mode).toBe("nolo");
    expect(g.ramSeat).toBeNull();
    expect(g.leader).toBe((g.dealer + 1) % 4);
  });

  it("forces rami under the Pakkorami boss", () => {
    let g = start("DECL");
    g = { ...g, boss: { id: "pakkorami", key: "boss.pakkorami" } };
    while (g.declSeq[g.declIdx] !== 0) g = advance(gameReducer(g, { type: "aiDeclare" }));
    g = gameReducer(g, { type: "declare", decl: "nolo" });
    expect(g.shows[0]?.decl).toBe("rami");
  });

  it("forces nolo under the Pakkonolo boss", () => {
    let g = start("DECL");
    g = { ...g, boss: { id: "pakkonolo", key: "boss.pakkonolo" } };
    while (g.declSeq[g.declIdx] !== 0) g = advance(gameReducer(g, { type: "aiDeclare" }));
    g = gameReducer(g, { type: "declare", decl: "rami" });
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
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", decl: "rami" }) : advance(g);
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
  const swapState = (over: Partial<GameState> = {}): GameState => {
    const g = start("SWAP");
    return {
      ...g,
      phase: "swap",
      hands: [[C("S", 14), C("H", 7), C("D", 3)], [], [], []],
      sideDeck: [C("S", 14, "steel"), C("C", 12, "mult")],
      swaps: 2,
      swapsLeft: 2,
      usedSide: [],
      ...over,
    };
  };

  it("swaps the twin and keeps the enhancement in one pick", () => {
    const g = swapState();
    const done = gameReducer(g, { type: "pickSideCard", uid: g.sideDeck[0].uid });
    const twin = done.hands[0].find((c) => c.s === "S" && c.r === 14);
    expect(twin?.enh).toBe("steel");
    expect(twin?.srcUid).toBe(g.sideDeck[0].uid);
    expect(done.hands[0]).toHaveLength(3);
    expect(done.swapsLeft).toBe(1);
  });

  it("leaves every other hand card alone: only the twin changes", () => {
    const g = swapState();
    const done = gameReducer(g, { type: "pickSideCard", uid: g.sideDeck[0].uid });

    /* The 7H would be the natural card to dump, which is exactly what the
       rule forbids — the swap never reaches it. */
    const rest = done.hands[0].filter((c) => c.s !== "S" || c.r !== 14);
    expect(rest.map((c) => `${c.s}${c.r}`).sort()).toEqual(["D3", "H7"]);
    expect(rest.every((c) => c.enh === null && !c.srcUid)).toBe(true);
  });

  it("refuses a side-deck card whose twin was not dealt", () => {
    const g = swapState();
    /* The QC is in nobody's hand here. */
    const picked = gameReducer(g, { type: "pickSideCard", uid: g.sideDeck[1].uid });
    expect(picked.toast?.key).toBe("toast.swapNoMatch");
    expect(picked.swapsLeft).toBe(2);
    expect(picked.usedSide).toEqual([]);
  });

  /* The swap panel disables its confirm button once the swaps are spent, and
     the bot checks swapsLeft before dispatching, so nothing in the project can
     reach this guard any more. The rule still lives in the reducer, so it is
     tested where it lives. */
  it("refuses a swap once the deal's swaps are spent", () => {
    const g = swapState({ swapsLeft: 0 });
    const picked = gameReducer(g, { type: "pickSideCard", uid: g.sideDeck[0].uid });
    expect(picked.toast?.key).toBe("toast.noSwapsLeft");
    expect(picked.usedSide).toEqual([]);
    expect(picked.hands[0]).toEqual(g.hands[0]);
  });

  it("does not offer a second swap for a card already swapped in", () => {
    const g = swapState({ sideDeck: [C("S", 14, "steel"), C("S", 14, "glass")] });
    const after = gameReducer(g, { type: "pickSideCard", uid: g.sideDeck[0].uid });
    expect(after.swapsLeft).toBe(1);

    /* The steel card is in hand now; the glass card must not trade it away. */
    const again = gameReducer(after, { type: "pickSideCard", uid: g.sideDeck[1].uid });
    expect(again.toast?.key).toBe("toast.swapNoMatch");
    expect(again.swapsLeft).toBe(1);
    expect(after.hands[0].find((c) => c.s === "S" && c.r === 14)?.enh).toBe("steel");
  });

  it("skips the swap phase when the side deck matches nothing in hand", () => {
    let g = createRun("SKIPSWAP");
    g = { ...g, sideDeck: [C("S", 14, "steel")] };
    g = gameReducer(g, { type: "startBlind" });
    /* The AS went to exactly one of the four hands. */
    const mine = g.hands[0].some((c) => c.s === "S" && c.r === 14);
    expect(g.phase).toBe(mine ? "swap" : "declare");
  });
});

describe("sooli", () => {
  /* Sooli is offered only when the opponents are the ones playing rami. */
  const toOffer = (): GameState => {
    for (const seed of ["SOOLI", "SOOLI2", "SOOLI3", "SOOLI4", "SOOLI5", "SOOLI6"]) {
      let g = start(seed);
      while (g.phase === "declare") {
        g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", decl: "nolo" }) : advance(g);
      }
      if (g.phase === "soolioffer") return g;
    }
    throw new Error("no seed produced a sooli offer");
  };

  it("sits the partner out and shrinks the trick to three", () => {
    let g = toOffer();
    g = gameReducer(g, { type: "acceptSooli" });
    expect(g.sooli).toBe(true);
    expect(g.phase).toBe("sooligive");

    const give = g.hands[0][0].uid;
    g = gameReducer(g, { type: "sooliGive", uid: give });
    expect(g.phase).toBe("sooliready");
    expect(g.hands[2]).toHaveLength(0);
    expect(g.hands[0]).toHaveLength(13);
    expect(g.sooliExchange?.gave.uid).toBe(give);
    expect(trickSize(g)).toBe(3);
    /* The sooli player always plays last. */
    expect(g.sooliOrder?.[2]).toBe(0);
  });

  it("can be declined, and then plays as a normal ryosto", () => {
    const g = gameReducer(toOffer(), { type: "declineSooli" });
    expect(g.sooli).toBe(false);
    expect(g.phase).toBe("play");
    expect(g.ramTeam).toBe(1);
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
    const money = once.money;
    /* The same action again does nothing, because the step is already done. */
    const again = gameReducer(once, { type: "showHandResult" });
    expect(again.money).toBe(money);
    expect(money).toBeGreaterThan(g.money);
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
    g = {
      ...g,
      screen: null,
      blindScore: 99999,
      target: 1,
      phase: "handend",
      handScore: 500,
      dealsLeft: 2,
      money: 20,
    };
    const s = gameReducer(g, { type: "showHandResult" }).screen;
    if (s?.kind !== "cashout") throw new Error("expected a cash-out screen");
    expect(s.reward + s.bonus + s.interest + s.spare).toBe(s.bank - 20);
  });
});

describe("the shop", () => {
  const openShop = (seed = "SHOP") =>
    gameReducer({ ...createRun(seed), money: 50 }, { type: "toShop" });

  it("charges for a purchase and marks the item sold", () => {
    const g = openShop();
    const item = (g.shop ?? [])[0];
    const after = gameReducer(g, { type: "buy", index: 0 });
    expect(after.money).toBe(g.money - item.price);
    expect(after.shop?.[0].sold).toBe(true);
  });

  it("refuses a purchase you cannot afford", () => {
    const g = { ...openShop(), money: 0 };
    const after = gameReducer(g, { type: "buy", index: 0 });
    expect(after.money).toBe(0);
    expect(after.shop?.[0].sold).toBe(false);
  });

  it("raises the reroll cost by two each time", () => {
    let g = openShop();
    const first = g.rerollCost;
    g = gameReducer(g, { type: "reroll" });
    expect(g.rerollCost).toBe(first + 2);
    g = gameReducer(g, { type: "reroll" });
    expect(g.rerollCost).toBe(first + 4);
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
        gameReducer({ ...createRun(`VOUCHER${i}`), money: 50, blindIdx }, { type: "toShop" }),
      );
    const flags = [0, 1, 2, 3].map((i) => shopsAt(i).every((g) => g.shopAfterBoss));
    expect(flags).toEqual([false, false, false, true]);
    const anyVoucher = (blindIdx: number) =>
      shopsAt(blindIdx).some((g) => (g.shop ?? []).some((it) => it.kind === "voucher"));
    expect([0, 1, 2].map(anyVoucher)).toEqual([false, false, false]);
    expect(anyVoucher(3)).toBe(true);
  });

  /* Buying into a full inventory. `replace` is an index into that inventory,
     and every case below names a non-zero one on purpose: a hard-coded
     splice(0, 1) would pass a test that only ever replaced the first item. */
  const shopWith = (item: ShopItem, over: Partial<GameState> = {}): GameState => ({
    ...createRun("REPLACE"),
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
    const after = gameReducer(g, { type: "buy", index: 0, replace: 2 });
    expect(after.jokers).toHaveLength(g.jokerSlots);
    expect(after.jokers.map((j) => j.id)).toEqual([
      JOKERS[1].id,
      JOKERS[2].id,
      JOKERS[4].id,
      JOKERS[0].id,
    ]);
    expect(after.money).toBe(g.money - jokerOffer.price);
    expect(after.shop?.[0].sold).toBe(true);
    expect(after.toast).toBeNull();
  });

  /* Asserted by uid rather than by length: a pop() instead of a splice would
     keep the count and throw away the wrong card. */
  it("replaces the named tuppipakka card", () => {
    const g = fullSideDeck();
    const after = gameReducer(g, { type: "buy", index: 0, replace: 1 });
    expect(after.sideDeck).toHaveLength(g.sideSlots);
    const uids = after.sideDeck.map((c) => c.uid);
    expect(uids).toContain(g.sideDeck[0].uid);
    expect(uids).not.toContain(g.sideDeck[1].uid);
    expect(uids).toContain(g.sideDeck[2].uid);
    const bought = after.sideDeck[after.sideDeck.length - 1];
    expect([bought.s, bought.r, bought.enh]).toEqual(["H", 7, "gold"]);
    expect(after.money).toBe(g.money - cardOffer.price);
    expect(after.shop?.[0].sold).toBe(true);
    expect(after.toast).toBeNull();
  });

  it("replaces the named trick", () => {
    const g = fullConsumables();
    const after = gameReducer(g, { type: "buy", index: 0, replace: 1 });
    expect(after.consumables).toHaveLength(g.consSlots);
    expect(after.consumables.map((c) => c.id)).toEqual([CONSUMABLES[1].id, CONSUMABLES[0].id]);
    expect(after.money).toBe(g.money - consOffer.price);
    expect(after.shop?.[0].sold).toBe(true);
    expect(after.toast).toBeNull();
  });

  /* An index nothing named must cost nothing: splice(-1, 1) would quietly
     drop the last joker, so the whole list is compared, not just its length. */
  it.each([-1, 4])("refuses a replace index of %i and keeps every joker", (replace) => {
    const g = fullJokers();
    const after = gameReducer(g, { type: "buy", index: 0, replace });
    expect(after.jokers.map((j) => j.id)).toEqual(g.jokers.map((j) => j.id));
    expect(after.money).toBe(g.money);
    expect(after.shop?.[0].sold).toBe(false);
    expect(after.toast?.key).toBe("toast.jokerSlotsFull");
  });

  it("discards nothing when the storage has room", () => {
    const g = shopWith(jokerOffer, { jokers: [JOKERS[1]], jokerSlots: 4 });
    const after = gameReducer(g, { type: "buy", index: 0, replace: 0 });
    expect(after.jokers.map((j) => j.id)).toEqual([JOKERS[1].id, JOKERS[0].id]);
    expect(after.money).toBe(g.money - jokerOffer.price);
    expect(after.shop?.[0].sold).toBe(true);
  });

  /* The three guards stay the rule's authority even though the shop now offers
     the picker instead of reaching them, exactly as the swap panel no longer
     reaches toast.swapNoMatch. */
  const FULL: Array<[string, () => GameState, string, (g: GameState) => unknown]> = [
    ["toast.jokerSlotsFull", fullJokers, "toast.jokerSlotsFull", (g) => g.jokers.length],
    ["toast.sideDeckFull", fullSideDeck, "toast.sideDeckFull", (g) => g.sideDeck.length],
    ["toast.trickSlotsFull", fullConsumables, "toast.trickSlotsFull", (g) => g.consumables.length],
  ];

  it.each(FULL)("raises %s for a buy with no replace", (_label, make, key, count) => {
    const g = make();
    const after = gameReducer(g, { type: "buy", index: 0 });
    expect(after.toast?.key).toBe(key);
    expect(count(after)).toBe(count(g));
    expect(after.money).toBe(g.money);
    expect(after.shop?.[0].sold).toBe(false);
  });

  it("pays out when selling a joker", () => {
    let g = { ...createRun("SELL"), money: 0 };
    const shop = gameReducer({ ...g, money: 50 }, { type: "toShop" });
    const jokerIdx = (shop.shop ?? []).findIndex((i) => i.kind === "joker");
    if (jokerIdx < 0) return;
    g = gameReducer(shop, { type: "buy", index: jokerIdx });
    const beforeSale = g.money;
    g = gameReducer(g, { type: "sellJoker", index: 0 });
    expect(g.jokers).toHaveLength(0);
    expect(g.money).toBeGreaterThan(beforeSale);
    expect(g.toast?.key).toBe("toast.soldJoker");
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

  it("counts nothing for the blind the run dies on", () => {
    const { state, banked } = bankBlinds("TOTALS", 60);
    expect(state.screen?.kind).toBe("gameover");
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
      g = g.declSeq[g.declIdx] === 0 ? act(g, { type: "declare", decl: "nolo" }) : advance(g);
    }
    if (g.phase === "soolioffer") g = act(g, { type: "declineSooli" });
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
    const g = { ...createRun("SKIP"), blindIdx, money: 12 };
    const after = gameReducer(g, { type: "skipBlind" });
    expect(after.blindIdx).toBe(blindIdx);
    expect(after.money).toBe(12);
    expect(after.beaten).toEqual(g.beaten);
  });

  it.each([0, 1])("still skips the ordinary blind at index %i", (blindIdx) => {
    const g = { ...createRun("SKIP"), blindIdx, money: 12 };
    const after = gameReducer(g, { type: "skipBlind" });
    expect(after.blindIdx).toBe(blindIdx + 1);
    expect(after.money).toBe(14);
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
    const g = gameReducer(
      { ...pre, sideDeck: [C(twin.s, twin.r, "wild")] },
      { type: "startBlind" },
    );

    expect(g.boss?.id).toBe("harmaus");
    expect(g.swapsLeft).toBe(0);
    /* anySwapAvailable reads the hand and the side deck, not the swaps left,
       so it says the deal would otherwise have had a swap to make. */
    expect(anySwapAvailable(g)).toBe(true);
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
    const armed = { ...far, sideDeck: [...far.sideDeck, C(twin2.s, twin2.r, "wild")] };

    const first = playToScreen(advance(armed), basicPolicy);
    expect(first.screen?.kind).toBe("dealend");
    const second = gameReducer(first, { type: "nextDeal" });
    expect(anySwapAvailable(second)).toBe(true);
    expect(second.swapsLeft).toBe(0);
    expect(second.phase).not.toBe("swap");
    expect(second.hands[0].every((c) => !c.enh)).toBe(true);
  });

  it("pays no interest at the cash-out under Verokarhu", () => {
    const opened = openedUnder("verokarhu", 2);
    /* Enough money that the interest would be the full $5 without the boss:
       a poor purse would score 0 interest either way and prove nothing. */
    const at = {
      ...opened,
      phase: "handend" as const,
      screen: null,
      money: 40,
      blindScore: opened.target,
      handScore: opened.target,
      dealsLeft: 2,
    };

    const taxed = gameReducer(at, { type: "showHandResult" });
    expect(taxed.screen?.kind).toBe("cashout");
    if (taxed.screen?.kind !== "cashout") return;
    expect(taxed.screen.interest).toBe(0);
    expect(taxed.money).toBe(40 + taxed.screen.reward + taxed.screen.bonus + taxed.screen.spare);

    const free = gameReducer({ ...at, boss: null }, { type: "showHandResult" });
    if (free.screen?.kind !== "cashout") throw new Error("no cash-out without the boss");
    expect(free.screen.interest).toBe(5);
    expect(free.money).toBe(taxed.money + 5);
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
      if (g.phase === "swap") g = act(g, { type: "finishSwap" });
      else if (g.phase === "declare") g = act(g, { type: "declare", decl: basicPolicy.declare(g) });
      else if (g.phase === "soolioffer") g = act(g, { type: "declineSooli" });
      else if (g.phase === "sooligive")
        g = act(g, { type: "sooliGive", uid: basicPolicy.sooliGive(g) });
      else if (g.phase === "sooliready") g = act(g, { type: "startSooliPlay" });
      else g = act(g, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(g) });
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
      if (g.phase === "swap") g = act(g, { type: "finishSwap" });
      else if (g.phase === "declare") g = act(g, { type: "declare", decl: basicPolicy.declare(g) });
      else if (g.phase === "soolioffer") g = act(g, { type: "declineSooli" });
      else if (g.phase === "sooligive")
        g = act(g, { type: "sooliGive", uid: basicPolicy.sooliGive(g) });
      else if (g.phase === "sooliready") g = act(g, { type: "startSooliPlay" });
      else g = act(g, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(g) });
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
    const g = gameReducer(mid, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(mid) });
    expect(g.screen).toBeNull();
    expect(nextTick(g)).not.toBeNull();
    expect(nextTick({ ...g, menu: "start" })).toBeNull();
    expect(nextTick({ ...g, menu: "challenges" })).toBeNull();
  });
});

describe("tricks (consumables)", () => {
  it("refuses to fire outside the play phase", () => {
    const g = {
      ...createRun("CONS"),
      consumables: [{ id: "kurkistus", key: "cons.kurkistus", g: "◉", p: 3 }],
    };
    const after = gameReducer(g, { type: "useConsumable", index: 0 });
    expect(after.consumables).toHaveLength(1);
    expect(after.toast?.key).toBe("toast.waitForDeal");
  });

  it("reveals the opponents' hands with Kurkistus", () => {
    const base = start("CONS");
    const g = {
      ...base,
      phase: "play" as const,
      consumables: [{ id: "kurkistus", key: "cons.kurkistus", g: "◉", p: 3 }],
    };
    const after = gameReducer(g, { type: "useConsumable", index: 0 });
    expect(after.reveal).toBe(true);
    expect(after.consumables).toHaveLength(0);
  });

  it("flips the declaration with Kannanvaihto only before the first trick", () => {
    const base = start("CONS");
    const cons = { id: "kannanvaihto", key: "cons.kannanvaihto", g: "↕", p: 5 };
    const early = gameReducer(
      { ...base, phase: "play", mode: "rami" as Mode, trickNo: 0, consumables: [cons] },
      { type: "useConsumable", index: 0 },
    );
    expect(early.mode).toBe("nolo");

    const late = gameReducer(
      { ...base, phase: "play", mode: "rami" as Mode, trickNo: 3, consumables: [cons] },
      { type: "useConsumable", index: 0 },
    );
    expect(late.mode).toBe("rami");
    expect(late.consumables).toHaveLength(1);
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
    expect(g.usTricks + g.themTricks).toBe(13);
    expect(total(g.support)).toBe(n * g.usTricks);
    expect(total(g.support) + n * g.themTricks).toBe(13 * n);
  });

  /* The sooli case the identity above cannot cover: three cards to a trick,
     and our side's only collected trick is the one that breaks the sooli. */
  it("collects three from a sooli trick, not four", () => {
    const after = resolving({
      mode: "rami",
      ramTeam: 0,
      sooli: true,
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
  usTricks: 7,
  themTricks: 6,
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
      usTricks: us,
      themTricks: them,
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
      s = gameReducer(s, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(s) });
      continue;
    }
    const tick = nextTick(s);
    if (!tick) throw new Error(`stuck in ${s.phase}`);
    s = gameReducer(s, tick.action);
  }
  throw new Error("did not reach the laydown");
}

describe("a challenge run", () => {
  const start = (seed = "CHAL1", over: Partial<GameState> = {}) =>
    advance(
      gameReducer({ ...createRun(seed), ...over }, { type: "startChallenge", id: "rummikub" }),
    );

  it("drops the whole roguelike shell", () => {
    const loaded: Partial<GameState> = {
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
    expect(g.money).toBe(0);
    expect(g.target).toBe(0);
    expect(g.jokers).toEqual([]);
    expect(g.consumables).toEqual([]);
    expect(g.vouchers).toEqual([]);
    expect(g.sideDeck).toEqual([]);
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
        s = gameReducer(s, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(s) });
      } else if (s.phase === "laydown" && s.layTurn === 0) {
        const combos = basicPolicy.laydown(s);
        s = gameReducer(s, combos ? { type: "layCards", combos } : { type: "passLaydown" });
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
    expect(r.state.shop).toBeNull();
    expect(r.state.blindIdx).toBe(0);
    expect(r.state.ante).toBe(1);
    expect(r.state.screen?.kind).toBe("challengeover");
  });

  it("scores nothing in the tricks and never touches the money", () => {
    let s = start("CHALSCORE");
    for (let guard = 0; guard < 3000 && s.phase !== "laydown"; guard++) {
      if (s.phase === "play" && s.turn === 0) {
        s = gameReducer(s, { type: "playCard", p: 0, uid: basicPolicy.chooseCard(s) });
      } else {
        const tick = nextTick(s);
        if (!tick) throw new Error(`nothing to do in ${s.phase}`);
        s = gameReducer(s, tick.action);
      }
      expect(s.base).toBe(0);
      expect(s.scored).toBe(0);
      expect(s.pop).toBeNull();
      expect(s.money).toBe(0);
    }
    expect(s.phase).toBe("laydown");
  });

  it("hands every card of the deal to the side that won it", () => {
    const s = toLaydown("CHALHANDS");
    const all = [...s.layHands[0], ...s.layHands[1]];
    expect(all).toHaveLength(52);
    expect(new Set(all.map((c) => c.uid)).size).toBe(52);
    expect(s.layHands[0]).toHaveLength(s.usTricks * 4);
    expect(s.layHands[1]).toHaveLength(s.themTricks * 4);
    expect(s.usTricks + s.themTricks).toBe(13);
    expect(s.table).toEqual([]);
    expect(s.layNo).toBe(0);
    expect(s.layPassed).toBe(0);
    expect(s.layScores).toEqual([0, 0]);
  });

  it("sorts both laydown hands by suit then rank", () => {
    const s = toLaydown("CHALSORT");
    for (const hand of s.layHands) {
      const order = hand.map((c) => [SUITS.indexOf(c.s), -c.r]);
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
    const after = gameReducer(g, { type: "layCards", combos: [set] });

    expect(after.layTurn).toBe(1);
    expect(after.layNo).toBe(1);
    expect(after.layPassed).toBe(0);
    expect(after.layScores).toEqual([27, 0]);
    expect(after.layHands[0]).toHaveLength(1);
    expect(after.table.map((r) => r.map((c) => c.uid))).toEqual([set]);
    expect(after.phase).toBe("laydown");
  });

  it("counts a pass and keeps the laydown open", () => {
    const after = gameReducer(setup(), { type: "passLaydown" });
    expect(after.layPassed).toBe(1);
    expect(after.layTurn).toBe(1);
    expect(after.phase).toBe("laydown");
  });

  it("ends the laydown on two passes in a row", () => {
    const g = gameReducer(stuck(), { type: "passLaydown" });
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
    const g = gameReducer(setup(), { type: "passLaydown" });
    expect(g.layTurn).toBe(1);
    /* The opponents hold three fives and lay them. */
    const after = gameReducer(g, { type: "aiLaydown" });
    expect(after.layScores[1]).toBe(15);
    expect(after.layPassed).toBe(0);
    expect(after.phase).toBe("laydown");
    const passed = gameReducer(after, { type: "passLaydown" });
    expect(passed.phase).toBe("laydown");
    expect(passed.layPassed).toBe(1);
  });

  it("scores pips laid minus cards left, and does not clamp it", () => {
    const g = stuck();
    const set = g.layHands[0].slice(0, 3).map((c) => c.uid);
    let s = gameReducer(g, { type: "layCards", combos: [set] });
    s = gameReducer(s, { type: "aiLaydown" });
    s = gameReducer(s, { type: "passLaydown" });
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
      gameReducer(state, { type: "layCards", combos }).toast?.key;

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
    const after = gameReducer(g, { type: "layCards", combos: [["nosuchuid"]] });
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
      gameReducer(mine, { type: "layCards", combos: [table.map((c) => c.uid)] }).toast?.key,
    ).toBe("toast.layNothing");
    const afterMe = gameReducer(mine, { type: "passLaydown" });
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

    const laid = gameReducer(g, { type: "layCards", combos: [theirSet] });
    expect(laid.table).toEqual([]);
    expect(laid.layScores).toEqual([0, 0]);
    expect(laid.layHands[1]).toHaveLength(3);
    expect(laid.layNo).toBe(0);
    expect(laid.layTurn).toBe(1);

    const passed = gameReducer(g, { type: "passLaydown" });
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
      expect(r.state.money).toBe(0);
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
    expect(back.jokers).toEqual(running.jokers);
    expect(back.consumables).toEqual(running.consumables);
    expect(back.boss).toBe(running.boss);
    expect(back.shop).toEqual(running.shop);
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
