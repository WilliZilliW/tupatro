import { describe, expect, it } from "vitest";
import { makeMint } from "./cards";
import {
  PX_BURNOUT_DRAW,
  PX_DRAW,
  PX_GROUP_CARDS,
  PX_HAND_MAX,
  PX_SCANDAL_DELTA,
  PX_START_HAND,
  PX_SYMBOL_BONUS,
  PX_TABLE,
  PX_TURN_CAP,
} from "./constants";
import {
  CHALLENGES,
  PX_ACTION_DECK,
  PX_EVENTS,
  PX_GROUP_HOME,
  PX_GROUP_NEED,
  PX_PARTIES,
  PX_PARTY_SYMBOL,
  PX_POLITICIANS,
  PX_SCANDAL_GROUPS,
} from "./content";
import { act, advance } from "./drive";
import {
  PX_GROUPS,
  PX_TACTICS,
  pxAiDiscard,
  pxDrawCards,
  pxLegalPlay,
  pxMove,
  pxNextSeat,
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
import type {
  GameState,
  PolitixState,
  PxCard,
  PxGroup,
  PxPartyId,
  PxTactic,
  PxVoter,
  Seat,
} from "./types";

const setup = (n = 1, owner: Seat = 0): PolitixState => pxSetup(makeRng(n), makeMint(0), owner);

let uidN = 0;
const card = (over: Partial<PxCard>): PxCard => ({
  uid: `t${++uidN}`,
  kind: "tactic",
  tactic: "growl",
  group: null,
  ...over,
});
const voter = (group: PxGroup): PxVoter => ({ uid: `v${++uidN}`, group, event: null });
const gs = (px: PolitixState) => ({ politix: px });
const hands = (...h: PxCard[][]) => h as PolitixState["hands"];

/* The seat is made a given politician of that politician's own party, so a
   skill and a symbol are known. */
function withPol(px: PolitixState, p: Seat, id: string): PolitixState {
  const row = PX_POLITICIANS.find((x) => x.id === id);
  const politicians = px.politicians.slice() as PolitixState["politicians"];
  const party = px.party.slice() as PolitixState["party"];
  politicians[p] = id;
  party[p] = row ? row.party : null;
  return { ...px, politicians, party };
}

describe("the data obeys its stated constraints", () => {
  it("gives every group a permutation of 3..6 with the 3 on its home tactic", () => {
    for (const gr of PX_GROUPS) {
      expect(PX_TACTICS.map((t) => PX_GROUP_NEED[gr][t]).sort()).toEqual([3, 4, 5, 6]);
      expect(PX_GROUP_NEED[gr][PX_GROUP_HOME[gr]]).toBe(3);
    }
    expect(PX_GROUP_NEED.blondes.charm).toBe(3);
    expect(PX_GROUP_NEED.youth.growl).toBe(3);
    expect(PX_GROUP_HOME).toMatchObject({
      blondes: "charm",
      youth: "growl",
      hippies: "argue",
      whitecollar: "argue",
      farmers: "evade",
      workers: "growl",
    });
  });

  it("makes every tactic the home of at least one group", () => {
    for (const t of PX_TACTICS) expect(PX_GROUPS.some((gr) => PX_GROUP_HOME[gr] === t)).toBe(true);
  });

  it("has nine distinct politicians, three a party, skills in 0..2 summing to 3", () => {
    expect(PX_POLITICIANS).toHaveLength(9);
    for (const p of PX_POLITICIANS) {
      expect(p.skills.every((s) => s >= 0 && s <= 2)).toBe(true);
      expect(p.skills.reduce((a, b) => a + b, 0)).toBe(3);
    }
    expect(new Set(PX_POLITICIANS.map((p) => p.skills.join())).size).toBe(9);
    for (const party of PX_PARTIES) {
      const own = PX_POLITICIANS.filter((p) => p.party === party);
      expect(own).toHaveLength(3);
      for (let t = 0; t < 4; t++)
        expect(own.reduce((a, p) => a + p.skills[t], 0)).toBeGreaterThanOrEqual(1);
    }
  });

  it("maps the three symbols to their groups", () => {
    expect(PX_PARTY_SYMBOL).toEqual({
      right: { symbol: "suv", group: "whitecollar" },
      centre: { symbol: "tractor", group: "farmers" },
      left: { symbol: "bus", group: "workers" },
    });
  });

  it("builds the 54-card action deck and the 46-card voter deck", () => {
    const px = setup();
    const all = [...px.draw, ...px.hands.flat()];
    expect(all).toHaveLength(54);
    expect(PX_ACTION_DECK.reduce((a, r) => a + r.n, 0)).toBe(54);
    for (const t of PX_TACTICS)
      expect(all.filter((c) => c.kind === "tactic" && c.tactic === t)).toHaveLength(9);
    expect(all.filter((c) => c.kind === "coffee")).toHaveLength(6);
    expect(all.filter((c) => c.kind === "burnout")).toHaveLength(4);
    expect(all.filter((c) => c.kind === "news")).toHaveLength(4);
    const scandals = all.filter((c) => c.kind === "scandal");
    expect(scandals).toHaveLength(4);
    expect(scandals.map((c) => c.group).sort()).toEqual([...PX_SCANDAL_GROUPS].sort());
    expect(PX_SCANDAL_GROUPS).toEqual(["hippies", "hippies", "blondes", "youth"]);
    const voters = [...px.table, ...px.voterDeck];
    expect(voters.filter((v) => v.group !== null)).toHaveLength(PX_GROUPS.length * PX_GROUP_CARDS);
    expect(voters.filter((v) => v.event !== null)).toHaveLength(4);
  });

  it("moves exactly one tactic by +1 in each of the four events", () => {
    expect(PX_EVENTS.map((e) => e.id).sort()).toEqual(["doping", "pageant", "reason", "recession"]);
    for (const e of PX_EVENTS) expect(e.delta).toBe(1);
    expect(new Set(PX_EVENTS.map((e) => e.tactic)).size).toBe(4);
    const by = (id: string) => PX_EVENTS.find((e) => e.id === id)?.tactic;
    expect([by("pageant"), by("reason"), by("recession"), by("doping")]).toEqual([
      "charm",
      "argue",
      "growl",
      "evade",
    ]);
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
  it("seats three parties once each, the fourth chair out, a politician of its own party", () => {
    for (let i = 0; i < 50; i++) {
      const owner = (i === 7 ? 2 : 0) as Seat;
      const px = setup(i + 1, owner);
      const playing = [owner, (owner + 1) % 4, (owner + 2) % 4] as Seat[];
      const out = ((owner + 3) % 4) as Seat;
      expect(px.party[out]).toBeNull();
      expect(px.politicians[out]).toBeNull();
      expect(px.hands[out]).toEqual([]);
      expect(px.burn[out]).toBeNull();
      expect(px.scandals[out]).toEqual([]);
      expect(playing.map((s) => px.party[s]).sort()).toEqual([...PX_PARTIES].sort());
      for (const s of playing) {
        expect(px.hands[s]).toHaveLength(PX_START_HAND);
        const row = PX_POLITICIANS.find((x) => x.id === px.politicians[s]);
        expect(row?.party).toBe(px.party[s]);
      }
      expect(playing).toContain(px.turn);
      expect(px.table).toHaveLength(PX_TABLE);
      expect(px.table.every((v) => v.group !== null)).toBe(true);
      expect(px.event).toBeNull();
    }
  });

  it("is a function of the seed alone", () => {
    expect(setup(5)).toEqual(setup(5));
    expect(setup(5)).not.toEqual(setup(6));
  });

  it("passes the turn clockwise past the sitting-out seat", () => {
    const px = setup(2, 0); // seat 3 sits out
    expect(pxNextSeat(px, 0)).toBe(1);
    expect(pxNextSeat(px, 1)).toBe(2);
    expect(pxNextSeat(px, 2)).toBe(0);
    const px2 = setup(2, 2); // seat 1 sits out
    expect(pxNextSeat(px2, 0)).toBe(2);
    expect(pxNextSeat(px2, 3)).toBe(0);
  });
});

describe("taking and power", () => {
  it("takes nothing under the need and one more card per extra point", () => {
    expect(pxTakeCount(2, 3, 5)).toBe(0);
    expect(pxTakeCount(3, 3, 5)).toBe(1);
    expect(pxTakeCount(5, 3, 4)).toBe(3);
    expect(pxTakeCount(5, 3, 5)).toBe(3);
    expect(pxTakeCount(9, 3, 2)).toBe(2);
  });

  it("reproduces the sheet's page-4 example without the +1 special: power 4, two cards", () => {
    let px = withPol(setup(), 0, "bulldog"); // centre, growl skill 2, symbol: farmers
    const growl = card({ tactic: "growl" });
    px = {
      ...px,
      event: "recession",
      table: [voter("youth"), voter("youth"), voter("youth"), voter("youth")],
      hands: hands([growl], px.hands[1], px.hands[2], px.hands[3]),
    };
    expect(pxPower(gs(px), 0, "youth", "growl", [growl.uid])).toBe(4);
    const r = pxResolve(gs(px), 0, {
      group: "youth",
      tactic: "growl",
      cards: [growl.uid],
      specials: [],
    });
    expect(r.ok && [r.power, r.need, r.take]).toEqual([4, 3, 2]);
  });

  it("adds the symbol bonus for the party's own group only, for all three parties", () => {
    const ids = { right: "orator", centre: "slippery", left: "smiler" } as const;
    for (const party of PX_PARTIES) {
      const px = withPol(setup(), 0, ids[party]);
      const skill = PX_POLITICIANS.find((x) => x.id === ids[party])?.skills[3] ?? 0;
      const growl = card({ tactic: "growl" });
      const held = { ...px, hands: hands([growl], [], [], []) };
      for (const gr of PX_GROUPS) {
        const bonus = PX_PARTY_SYMBOL[party].group === gr ? PX_SYMBOL_BONUS : 0;
        expect(pxPower(gs(held), 0, gr, "growl", [growl.uid])).toBe(1 + skill + bonus);
      }
    }
  });

  it("lowers one group by exactly one under all four tactics per scandal, as on the sheet's p. 5", () => {
    const px0 = withPol(setup(), 0, "orator"); // right, symbol whitecollar
    const sc = card({ kind: "scandal", tactic: null, group: "hippies" });
    for (const tactic of PX_TACTICS) {
      const c = card({ tactic });
      const clean = { ...px0, hands: hands([c], [], [], []) };
      const dirty = { ...clean, scandals: [[sc], [], [], []] as PolitixState["scandals"] };
      const power = (px: PolitixState, gr: PxGroup) => pxPower(gs(px), 0, gr, tactic, [c.uid]);
      expect(power(dirty, "hippies")).toBe(power(clean, "hippies") + PX_SCANDAL_DELTA);
      for (const gr of PX_GROUPS.filter((x) => x !== "hippies"))
        expect(power(dirty, gr)).toBe(power(clean, gr));
    }
  });

  it("counts a scandal played in the same turn at the target, not at the player", () => {
    const px0 = withPol(withPol(setup(), 0, "orator"), 1, "bulldog"); // right vs centre
    const sc = card({ kind: "scandal", tactic: null, group: "youth" });
    const px: PolitixState = { ...px0, hands: hands([sc], [], [], []) };
    const r = pxResolve(gs(px), 0, {
      group: null,
      tactic: null,
      cards: [],
      specials: [{ uid: sc.uid, target: 1 }],
    });
    expect(r.ok && r.scandals[1]).toHaveLength(1);
    expect(r.ok && r.scandals[0]).toHaveLength(0);
  });
});

describe("what a play may be", () => {
  /* Seat 0 is the Right's orator (growl skill 0), seat 1 the Centre's, seat 2
     the Left's; seat 3 sits out. */
  const base = (): { px: PolitixState; growl: PxCard } => {
    const px0 = setup(1, 0);
    const px1 = withPol(withPol(withPol(px0, 0, "orator"), 1, "slippery"), 2, "smiler");
    const growl = card({ tactic: "growl" });
    return {
      growl,
      px: { ...px1, table: [voter("youth"), voter("workers")], hands: hands([growl], [], [], []) },
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
    const p2 = { ...px, hands: hands([coffee], [], [], []) };
    expect(
      pxLegalPlay(gs(p2), 0, {
        group: "youth",
        tactic: "growl",
        cards: [coffee.uid],
        specials: [],
      }),
    ).toBe("noTactic");
    const growl = card({ tactic: "growl" });
    const p3 = { ...px, hands: hands([growl], [], [], []) };
    expect(
      pxLegalPlay(gs(p3), 0, {
        group: "hippies",
        tactic: "growl",
        cards: [growl.uid],
        specials: [],
      }),
    ).toBe("noGroup");
  });

  it("refuses any play by the sitting-out seat", () => {
    const { px } = base();
    const growl = card({ tactic: "growl" });
    const held = { ...px, hands: hands([], [], [], [growl]) };
    expect(
      pxLegalPlay(gs(held), 3, {
        group: "youth",
        tactic: "growl",
        cards: [growl.uid],
        specials: [],
      }),
    ).toBe("badCards");
  });

  it("allows burnout only onto a seat of another party that has none", () => {
    const { px } = base();
    const b = card({ kind: "burnout", tactic: null });
    const hold = { ...px, hands: hands([b], [], [], []) };
    const aim = (state: PolitixState, target: Seat) =>
      pxLegalPlay(gs(state), 0, {
        group: null,
        tactic: null,
        cards: [],
        specials: [{ uid: b.uid, target }],
      });
    expect(aim(hold, 0)).toBe("badBurnout"); // oneself
    expect(aim(hold, 3)).toBe("badBurnout"); // the sitting-out seat
    expect(aim(hold, 1)).toBeNull();
    expect(aim(hold, 2)).toBeNull();
    const burnt = {
      ...hold,
      burn: [null, card({ kind: "burnout", tactic: null }), null, null],
    } as PolitixState;
    expect(aim(burnt, 1)).toBe("badBurnout"); // never doubled
  });

  it("allows a scandal only onto a seat of another party, and lets them stack", () => {
    const { px } = base();
    const a = card({ kind: "scandal", tactic: null, group: "hippies" });
    const b = card({ kind: "scandal", tactic: null, group: "hippies" });
    const hold = { ...px, hands: hands([a, b], [], [], []) };
    const aim = (...targets: Seat[]) =>
      pxResolve(gs(hold), 0, {
        group: null,
        tactic: null,
        cards: [],
        specials: targets.map((target, i) => ({ uid: [a, b][i].uid, target })),
      });
    expect(aim(0)).toMatchObject({ ok: false, refusal: "badScandal" });
    expect(aim(3)).toMatchObject({ ok: false, refusal: "badScandal" });
    const both = aim(1, 1);
    expect(both.ok && both.scandals[1]).toHaveLength(2);
    const split = aim(1, 2);
    expect(split.ok && [split.scandals[1].length, split.scandals[2].length]).toEqual([1, 1]);
  });

  it("lets yesterday's news remove exactly one burnout or scandal, own included", () => {
    const { px } = base();
    const news = card({ kind: "news", tactic: null });
    const sc = card({ kind: "scandal", tactic: null, group: "youth" });
    const own = card({ kind: "burnout", tactic: null });
    const hold = {
      ...px,
      hands: hands([news], [], [], []),
      scandals: [[], [sc], [], []] as PolitixState["scandals"],
      burn: [own, null, null, null] as PolitixState["burn"],
    };
    const use = (remove: string) =>
      pxResolve(gs(hold), 0, {
        group: null,
        tactic: null,
        cards: [],
        specials: [{ uid: news.uid, target: 0, remove }],
      });
    const r = use(sc.uid);
    expect(r.ok && r.scandals[1]).toEqual([]);
    expect(r.ok && r.burn[0]?.uid).toBe(own.uid);
    expect(r.ok && r.discard.map((c) => c.uid).sort()).toEqual([sc.uid, news.uid].sort());
    const own2 = use(own.uid);
    expect(own2.ok && own2.burn[0]).toBeNull();
    // a card in a hand, a party symbol, nothing
    expect(use(news.uid)).toMatchObject({ ok: false, refusal: "badNews" });
    expect(use("suv")).toMatchObject({ ok: false, refusal: "badNews" });
    expect(use("")).toMatchObject({ ok: false, refusal: "badNews" });
  });

  it("takes nothing from a specials-only play", () => {
    const { px } = base();
    const sc = card({ kind: "scandal", tactic: null, group: "youth" });
    const hold = { ...px, hands: hands([sc], [], [], []) };
    const r = pxResolve(gs(hold), 0, {
      group: null,
      tactic: null,
      cards: [],
      specials: [{ uid: sc.uid, target: 1 }],
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
    px.voterDeck = [voter("youth"), { uid: "e", group: null, event: "doping" }, voter("youth")];
    pxRefill(px);
    expect(px.event).toBe("doping");
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
  it("reproduces the sheet's page-6 example, as two-party input: left wins on the third-weakest group", () => {
    const right = [6, 5, 4, 2, 2, 1];
    const left = [6, 5, 5, 3, 2, 1];
    expect(pxWinner([left, right], [30, 30])).toEqual([0]);
    expect(pxWinner([right, left], [30, 30])).toEqual([1]);
  });

  it("finds a unique winner among three", () => {
    expect(
      pxWinner(
        [
          [4, 4, 4, 3, 3, 3],
          [5, 4, 4, 4, 3, 2],
          [5, 5, 4, 3, 3, 2],
        ],
        [20, 20, 20],
      ),
    ).toEqual([0]);
  });

  it("falls to the fewer turns on equal vectors", () => {
    const v = [4, 4, 4, 3, 3, 3];
    expect(pxWinner([v, v.slice().reverse()], [25, 31])).toEqual([0]);
    expect(pxWinner([v, v], [31, 25])).toEqual([1]);
    expect(pxWinner([[1, 1, 1, 1, 1, 1], v, v], [1, 31, 25])).toEqual([2]);
  });

  it("returns every party tied for best on a full tie", () => {
    const v = [4, 4, 4, 3, 3, 3];
    expect(pxWinner([v, v], [25, 25])).toEqual([0, 1]);
    expect(pxWinner([[1, 1, 1, 1, 1, 1], v, v], [3, 25, 25])).toEqual([1, 2]);
    expect(pxWinner([v, v, v], [25, 25, 25])).toEqual([0, 1, 2]);
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
    ).toEqual([0]);
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
  it("always end, take all 42 cards, and favour no party", () => {
    const turns: number[] = [];
    const wins: Record<PxPartyId, number> = { right: 0, centre: 0, left: 0 };
    let decided = 0;
    for (let i = 0; i < 200; i++) {
      const g = playPolitix(`PXM${i}`);
      const px = g.politix as PolitixState;
      expect(g.screen?.kind, `seed ${i}`).toBe("politixover");
      expect(px.turnNo).toBeLessThanOrEqual(PX_TURN_CAP);
      expect(px.table).toEqual([]);
      expect(px.voterDeck).toEqual([]);
      const total = PX_PARTIES.reduce(
        (a, id) => a + px.collected[id].reduce((x, y) => x + y, 0),
        0,
      );
      expect(total).toBe(PX_GROUPS.length * PX_GROUP_CARDS);
      turns.push(px.turnNo);
      const s = g.screen;
      if (s?.kind === "politixover" && s.winners.length === 1) {
        wins[s.winners[0]]++;
        decided++;
      }
    }
    turns.sort((a, b) => a - b);
    expect(turns[100]).toBeGreaterThanOrEqual(30);
    expect(turns[100]).toBeLessThanOrEqual(150);
    for (const id of PX_PARTIES) {
      expect(wins[id] / decided, id).toBeGreaterThanOrEqual(0.2);
      expect(wins[id] / decided, id).toBeLessThanOrEqual(0.47);
    }
  });

  it("never gives the turn to the sitting-out seat, from owner 0 or owner 2", () => {
    for (const owner of [0, 2] as Seat[]) {
      let g = gameReducer(createRun("PXTURN", 0, owner), {
        type: "startChallenge",
        id: "politix",
        seed: "PXTURN",
      });
      const out = ((owner + 3) % 4) as Seat;
      while (!g.screen && g.politix && g.politix.turnNo <= 600) {
        expect(g.politix.turn).not.toBe(out);
        expect(g.politix.party[g.politix.turn]).not.toBeNull();
        g = act(g, pxMove(g, g.politix.turn));
      }
      expect(g.screen?.kind).toBe("politixover");
    }
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
