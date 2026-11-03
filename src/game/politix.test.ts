import { describe, expect, it } from "vitest";
import { makeMint } from "./cards";
import {
  PX_BURNOUT_DRAW,
  PX_DRAW,
  PX_GROUP_CARDS,
  PX_HAND_MAX,
  PX_START_HAND,
  PX_TABLE,
  PX_TURN_CAP,
} from "./constants";
import { CHALLENGES, PX_ACTION_DECK, PX_EVENTS, PX_GROUP_NEED, PX_POLITICIANS } from "./content";
import { act, advance } from "./drive";
import {
  PX_GROUPS,
  PX_TACTICS,
  pxAiDiscard,
  pxDrawCards,
  pxLegalPlay,
  pxMove,
  pxPower,
  pxRefill,
  pxResolve,
  pxSetup,
  pxTakeCount,
  pxWinner,
} from "./politix";
import { matchModeOf } from "./race";
import { makeRng } from "./rng";
import { nextTick, waitingSeat } from "./schedule";
import { gameReducer } from "./reducer";
import { createRun } from "./state";
import { playPolitix } from "../test/bot";
import type { GameState, PolitixState, PxCard, PxGroup, PxTactic, PxVoter, Seat } from "./types";

const setup = (n = 1): PolitixState => pxSetup(makeRng(n), makeMint(0));

let uidN = 0;
const card = (over: Partial<PxCard>): PxCard => ({
  uid: `t${++uidN}`,
  kind: "tactic",
  tactic: "growl",
  group: null,
  delta: 0,
  ...over,
});
const voter = (group: PxGroup): PxVoter => ({ uid: `v${++uidN}`, group, event: null });
const gs = (px: PolitixState) => ({ politix: px });

/* The seat's politician is overridden so a skill is known. */
function withPol(px: PolitixState, p: Seat, id: string): PolitixState {
  const politicians = px.politicians.slice() as PolitixState["politicians"];
  politicians[p] = id;
  return { ...px, politicians };
}

describe("the data obeys its stated constraints", () => {
  it("gives every group a permutation of 2..5 and the sheet's two figures", () => {
    for (const gr of PX_GROUPS)
      expect(PX_TACTICS.map((t) => PX_GROUP_NEED[gr][t]).sort()).toEqual([2, 3, 4, 5]);
    expect(PX_GROUP_NEED.blondes.charm).toBe(3);
    expect(PX_GROUP_NEED.youth.growl).toBe(3);
  });

  it("makes every tactic the cheapest somewhere", () => {
    for (const t of PX_TACTICS)
      expect(PX_GROUPS.some((gr) => PX_GROUP_NEED[gr][t] === 2)).toBe(true);
  });

  it("has eight distinct politicians whose skills lie in 0..2 and sum to 3", () => {
    expect(PX_POLITICIANS).toHaveLength(8);
    for (const p of PX_POLITICIANS) {
      expect(p.skills.every((s) => s >= 0 && s <= 2)).toBe(true);
      expect(p.skills.reduce((a, b) => a + b, 0)).toBe(3);
    }
    expect(new Set(PX_POLITICIANS.map((p) => p.skills.join())).size).toBe(8);
  });

  it("builds the 60-card action deck and the 46-card voter deck", () => {
    const px = setup();
    const all = [...px.draw, ...px.hands.flat()];
    expect(all).toHaveLength(60);
    for (const t of PX_TACTICS)
      expect(all.filter((c) => c.kind === "tactic" && c.tactic === t)).toHaveLength(9);
    expect(all.filter((c) => c.kind === "coffee")).toHaveLength(6);
    expect(all.filter((c) => c.kind === "mod")).toHaveLength(12);
    for (const gr of PX_GROUPS) {
      expect(all.filter((c) => c.group === gr && c.delta === 1)).toHaveLength(1);
      expect(all.filter((c) => c.group === gr && c.delta === -1)).toHaveLength(1);
    }
    expect(all.filter((c) => c.kind === "burnout")).toHaveLength(3);
    expect(all.filter((c) => c.kind === "news")).toHaveLength(3);
    expect(PX_ACTION_DECK.reduce((a, r) => a + r.n, 0)).toBe(60);
    const voters = [...px.table, ...px.voterDeck];
    expect(voters.filter((v) => v.group !== null)).toHaveLength(PX_GROUPS.length * PX_GROUP_CARDS);
    expect(voters.filter((v) => v.event !== null)).toHaveLength(4);
  });

  it("moves exactly one tactic by one in each event, the recession being +1 growl", () => {
    expect(PX_EVENTS).toHaveLength(4);
    for (const e of PX_EVENTS) expect(Math.abs(e.delta)).toBe(1);
    const r = PX_EVENTS.find((e) => e.id === "recession");
    expect([r?.tactic, r?.delta]).toEqual(["growl", 1]);
  });

  it("lists the mode as a ninth id that is not a match", () => {
    expect(CHALLENGES.find((c) => c.id === "politix")).toMatchObject({
      g: "X",
      deals: 0,
      target: 0,
    });
    expect(matchModeOf("politix")).toBeNull();
  });
});

describe("setup", () => {
  it("deals four distinct politicians, four cards a seat, eight voters and no event", () => {
    const px = setup(3);
    expect(new Set(px.politicians).size).toBe(4);
    for (const h of px.hands) expect(h).toHaveLength(PX_START_HAND);
    expect(px.table).toHaveLength(PX_TABLE);
    expect(px.table.every((v) => v.group !== null)).toBe(true);
    expect(px.event).toBeNull();
  });

  it("is a function of the seed alone", () => {
    expect(setup(5)).toEqual(setup(5));
    expect(setup(5)).not.toEqual(setup(6));
  });
});

describe("taking and power", () => {
  it("takes nothing under the need and one more card per extra point", () => {
    expect(pxTakeCount(2, 3, 5)).toBe(0);
    expect(pxTakeCount(3, 3, 5)).toBe(1);
    expect(pxTakeCount(5, 3, 5)).toBe(3);
    expect(pxTakeCount(9, 3, 2)).toBe(2);
  });

  it("reproduces the sheet's page-4 example: power 5, three cards", () => {
    let px = withPol(setup(), 0, "bulldog"); // growl skill 2
    const growl = card({ tactic: "growl" });
    const plus = card({ kind: "mod", tactic: null, group: "youth", delta: 1 });
    px = {
      ...px,
      event: "recession",
      table: [voter("youth"), voter("youth"), voter("youth")],
      hands: [[growl], px.hands[1], px.hands[2], px.hands[3]],
      mods: [[plus], [], [], []],
    };
    expect(pxPower(gs(px), 0, "youth", "growl", [growl.uid])).toBe(5);
    const r = pxResolve(gs(px), 0, {
      group: "youth",
      tactic: "growl",
      cards: [growl.uid],
      specials: [],
    });
    expect(r.ok && [r.power, r.need, r.take]).toEqual([5, 3, 3]);
  });

  it("counts a +1 played in the same turn before the take", () => {
    const px0 = withPol(setup(), 0, "bulldog");
    const growl = card({ tactic: "growl" });
    const plus = card({ kind: "mod", tactic: null, group: "youth", delta: 1 });
    const px: PolitixState = {
      ...px0,
      table: [voter("youth"), voter("youth")],
      hands: [[growl, plus], [], [], []],
    };
    // 1 card + skill 2 = 3 meets the need alone; the +1 buys a second card.
    const r = pxResolve(gs(px), 0, {
      group: "youth",
      tactic: "growl",
      cards: [growl.uid],
      specials: [{ uid: plus.uid, target: 0 }],
    });
    expect(r.ok && r.take).toBe(2);
  });
});

describe("what a play may be", () => {
  const base = (): { px: PolitixState; growl: PxCard } => {
    const px0 = withPol(setup(), 0, "orator"); // growl skill 0
    const growl = card({ tactic: "growl" });
    return {
      growl,
      px: { ...px0, table: [voter("youth"), voter("workers")], hands: [[growl], [], [], []] },
    };
  };

  it("refuses an empty play, an unknown card and a weak play", () => {
    const { px, growl } = base();
    const play = { group: "youth" as const, tactic: "growl" as PxTactic, specials: [] };
    expect(pxLegalPlay(gs(px), 0, { ...play, cards: [] })).toBe("empty");
    expect(pxLegalPlay(gs(px), 0, { ...play, cards: ["nope"] })).toBe("badCards");
    expect(pxLegalPlay(gs(px), 0, { ...play, cards: [growl.uid] })).toBe("weak");
  });

  it("refuses coffee alone, and a group that is not on the table", () => {
    const { px } = base();
    const coffee = card({ kind: "coffee", tactic: null });
    const p2 = { ...px, hands: [[coffee], [], [], []] as PolitixState["hands"] };
    expect(
      pxLegalPlay(gs(p2), 0, {
        group: "youth",
        tactic: "growl",
        cards: [coffee.uid],
        specials: [],
      }),
    ).toBe("noTactic");
    const growl = card({ tactic: "growl" });
    const p3 = { ...px, hands: [[growl], [], [], []] as PolitixState["hands"] };
    expect(
      pxLegalPlay(gs(p3), 0, {
        group: "hippies",
        tactic: "growl",
        cards: [growl.uid],
        specials: [],
      }),
    ).toBe("noGroup");
  });

  it("allows burnout only onto an opposing seat that has none", () => {
    const { px } = base();
    const b = card({ kind: "burnout", tactic: null });
    const hold = { ...px, hands: [[b], [], [], []] as PolitixState["hands"] };
    const aim = (target: Seat) =>
      pxLegalPlay(gs(hold), 0, {
        group: null,
        tactic: null,
        cards: [],
        specials: [{ uid: b.uid, target }],
      });
    expect(aim(2)).toBe("badBurnout"); // own partner
    expect(aim(1)).toBeNull();
    const burnt = {
      ...hold,
      burn: [null, card({ kind: "burnout", tactic: null }), null, null],
    } as PolitixState;
    expect(
      pxLegalPlay(gs(burnt), 0, {
        group: null,
        tactic: null,
        cards: [],
        specials: [{ uid: b.uid, target: 1 }],
      }),
    ).toBe("badBurnout");
  });

  it("lets yesterday's news remove exactly one special, and nothing else", () => {
    const { px } = base();
    const news = card({ kind: "news", tactic: null });
    const mod = card({ kind: "mod", tactic: null, group: "youth", delta: -1 });
    const hold = {
      ...px,
      hands: [[news], [], [], []] as PolitixState["hands"],
      mods: [[], [mod], [], []] as PolitixState["mods"],
    };
    const r = pxResolve(gs(hold), 0, {
      group: null,
      tactic: null,
      cards: [],
      specials: [{ uid: news.uid, target: 0, remove: mod.uid }],
    });
    expect(r.ok && r.mods[1]).toEqual([]);
    expect(r.ok && r.discard.map((c) => c.uid).sort()).toEqual([mod.uid, news.uid].sort());
    expect(
      pxLegalPlay(gs(hold), 0, {
        group: null,
        tactic: null,
        cards: [],
        specials: [{ uid: news.uid, target: 0, remove: "party-symbol" }],
      }),
    ).toBe("badNews");
  });

  it("takes nothing from a specials-only play", () => {
    const { px } = base();
    const mod = card({ kind: "mod", tactic: null, group: "youth", delta: 1 });
    const hold = { ...px, hands: [[mod], [], [], []] as PolitixState["hands"] };
    const r = pxResolve(gs(hold), 0, {
      group: null,
      tactic: null,
      cards: [],
      specials: [{ uid: mod.uid, target: 0 }],
    });
    expect(r.ok && r.take).toBe(0);
  });
});

describe("piles and the table", () => {
  it("rebuilds an empty draw pile from the discard through the Rng, then runs dry quietly", () => {
    const px = { ...setup(), hands: [[], [], [], []] as PolitixState["hands"] };
    const a = card({}),
      b = card({}),
      c = card({});
    px.draw = [a];
    px.discard = [b, c];
    pxDrawCards(px, 0, 3, makeRng(1));
    expect(px.hands[0]).toHaveLength(3);
    expect(px.discard).toEqual([]);
    pxDrawCards(px, 0, 2, makeRng(1));
    expect(px.hands[0]).toHaveLength(3);
  });

  it("refills to eight and lets an event replace the previous without counting", () => {
    const px = setup();
    px.table = px.table.slice(0, 5);
    px.voterDeck = [voter("youth"), { uid: "e", group: null, event: "tabloid" }, voter("youth")];
    pxRefill(px);
    expect(px.event).toBe("tabloid");
    expect(px.table).toHaveLength(7);
    expect(px.voterDeck).toEqual([]);
  });

  it("discards the least useful cards down to the hand limit", () => {
    const px = setup();
    const extra = [card({ kind: "news", tactic: null }), card({ kind: "burnout", tactic: null })];
    px.hands[0] = [...Array.from({ length: 10 }, () => card({ tactic: "argue" })), ...extra];
    expect(pxAiDiscard(px, 0).sort()).toEqual(extra.map((c) => c.uid).sort());
    px.hands[0] = px.hands[0].slice(0, PX_HAND_MAX);
    expect(pxAiDiscard(px, 0)).toEqual([]);
  });
});

describe("the sheet's constants", () => {
  it("are the sheet's", () => {
    expect([PX_DRAW, PX_BURNOUT_DRAW, PX_HAND_MAX, PX_START_HAND, PX_TABLE]).toEqual([
      3, 2, 10, 4, 8,
    ]);
  });
});

describe("scoring", () => {
  it("reproduces the sheet's page-6 example: left wins on the third-weakest group", () => {
    const right = [6, 5, 4, 2, 2, 1];
    const left = [6, 5, 5, 3, 2, 1];
    expect(pxWinner([left, right], [30, 30])).toBe(0);
    expect(pxWinner([right, left], [30, 30])).toBe(1);
  });

  it("falls to the fewer turns on equal vectors, and to a draw on equal turns", () => {
    const v = [4, 4, 4, 3, 3, 3];
    expect(pxWinner([v, v.slice().reverse()], [25, 31])).toBe(0);
    expect(pxWinner([v, v], [31, 25])).toBe(1);
    expect(pxWinner([v, v], [25, 25])).toBe("draw");
  });

  it("counts zero-count groups in the comparison", () => {
    expect(
      pxWinner(
        [
          [7, 7, 7, 7, 7, 7],
          [0, 0, 0, 0, 0, 0],
        ],
        [1, 1],
      ),
    ).toBe(0);
  });
});

describe("a whole game through the reducer", () => {
  const start = (seed: string): GameState =>
    gameReducer(createRun(seed), { type: "startChallenge", id: "politix", seed });

  it("is reproducible from its seed", () => {
    const a = playPolitix("REPLAY1");
    const b = playPolitix("REPLAY1");
    expect(a.politix).toEqual(b.politix);
    expect(a.rngState).toBe(b.rngState);
    expect(playPolitix("REPLAY2").politix).not.toEqual(a.politix);
  });

  it("deals no tuppi hands and starts in pxturn", () => {
    const g = start("PXSTART");
    expect(g.hands.every((h) => h.length === 0)).toBe(true);
    expect(g.phase).toBe("pxturn");
    expect(g.politix).not.toBeNull();
  });

  it("schedules AI turns only, with a key carrying the turn number and phase", () => {
    const g = start("PXTICK");
    const at = (turn: Seat, over: Partial<GameState> = {}): GameState => ({
      ...g,
      ...over,
      politix: { ...(g.politix as PolitixState), turn },
    });
    expect(nextTick(at(0))).toBeNull();
    expect(waitingSeat(at(0))).toBe(0);
    const t = nextTick(at(1));
    expect(t?.action).toEqual({ type: "aiPolitix", p: 1 });
    expect(t?.key).toBe("pxturn:0");
    expect(waitingSeat(at(1))).toBeNull();
    expect(nextTick(at(1, { screen: { kind: "blindselect" } }))).toBeNull();
  });

  it("settles when pxMove decides for every seat, ending with the voter deck and table empty", () => {
    const g = playPolitix("PXSETTLE");
    expect(g.screen?.kind).toBe("politixover");
    expect(g.politix?.table).toEqual([]);
    expect(g.politix?.voterDeck).toEqual([]);
  });
});

describe("measured: 200 seeded all-bot games", () => {
  it("always end, take all 42 cards, and favour neither party", () => {
    const turns: number[] = [];
    const wins = [0, 0];
    for (let i = 0; i < 200; i++) {
      const g = playPolitix(`PXM${i}`);
      const px = g.politix as PolitixState;
      expect(g.screen?.kind, `seed ${i}`).toBe("politixover");
      expect(px.turnNo).toBeLessThanOrEqual(PX_TURN_CAP);
      const total = px.collected.flat().reduce((a, b) => a + b, 0);
      expect(total).toBe(PX_GROUPS.length * PX_GROUP_CARDS);
      turns.push(px.turnNo);
      const s = g.screen;
      if (s?.kind === "politixover" && s.winner !== "draw") wins[s.winner]++;
    }
    turns.sort((a, b) => a - b);
    expect(turns[100]).toBeGreaterThanOrEqual(30);
    expect(turns[100]).toBeLessThanOrEqual(150);
    const share = wins[0] / (wins[0] + wins[1]);
    expect(share).toBeGreaterThanOrEqual(0.35);
    expect(share).toBeLessThanOrEqual(0.65);
  });

  it("only ever proposes a play the rule accepts", () => {
    let g = gameReducer(createRun("PXLEGAL"), {
      type: "startChallenge",
      id: "politix",
      seed: "PXLEGAL",
    });
    g = advance(g);
    let plays = 0;
    while (!g.screen && g.politix) {
      const move = pxMove(g, g.politix.turn);
      if (move.type === "pxPlay") {
        plays++;
        expect(pxLegalPlay(g, g.politix.turn, move)).toBeNull();
      }
      g = act(g, move);
    }
    expect(plays).toBeGreaterThan(0);
  });
});
