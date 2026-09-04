/* The flow. Phases are data and the bot plays through them, so a whole deal
   can be tested without a browser and without a timer. */
import { describe, expect, it } from "vitest";
import { act, advance } from "./drive";
import { gameReducer } from "./reducer";
import { anySwapAvailable, legalCards, trickSize } from "./rules";
import { createRun } from "./state";
import { makeRng, seedHash } from "./rng";
import { rollCardOffer } from "./shop";
import { ANTES } from "./constants";
import { BIG_BOSSES, PARTY_IDS, SMALL_BOSSES } from "./content";
import { nextTick } from "./schedule";
import { basicPolicy, playBlind, playRun, playToScreen } from "../test/bot";
import { card as C } from "../test/factories";
import type { GameState, Mode, Suit } from "./types";

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
