/* The state is seat-absolute: nothing in the engine knows which seat the
   player is in. Two things have to be true at once, and this file holds both.

   1. Nothing moved. The refactor that removed the us/them axis must produce
      the same runs it produced before, deal for deal. The literals below were
      captured from the build immediately before the change and are pinned
      here; any drift in the engine moves at least one of them.
   2. The seat can move. The same deal, played by the same decisions, comes out
      identical with the human sitting at any of the four seats. */
import { describe, expect, it } from "vitest";
import { aiDeclare, chooseAI, chooseLaydown } from "./ai";
import { econOf } from "./economy";
import { partnerOf, teamOf } from "./constants";
import { advance } from "./drive";
import { gameReducer } from "./reducer";
import { makeRng } from "./rng";
import { nextTick } from "./schedule";
import { createRun, newEconomy } from "./state";
import { basicPolicy, playBlind, playRun, playToScreen, type Policy } from "../test/bot";
import type { GameState, Seat } from "./types";

/* ==================== the pinned golden ====================
   Captured from the pre-change build with the same three seeds and the same
   fifty-seed aggregate. Four blinds, because a whole ten-ante run is slow and
   four already walks the deal, the cash-out, the shop and the blind roll. */

const NAMED = ["SEATGOLD1", "SEATGOLD2", "SEATGOLD3"] as const;

type Golden = {
  deals: number[];
  outcome: "victory" | "gameover" | "limit";
  money: number;
  ante: number;
  blindIdx: number;
  runScore: number;
  /* The first deal's four hands, as card type ids. The shuffle is where a
     seat-absolute mistake would show first, and the run's own end leaves every
     hand empty. */
  hands: string[][];
};

const GOLDEN: Record<(typeof NAMED)[number], Golden> = {
  SEATGOLD1: {
    deals: [0, 1176, 0, 0, 4220, 0, 0, 0],
    outcome: "gameover",
    money: 22,
    ante: 1,
    blindIdx: 2,
    runScore: 5396,
    hands: [
      ["S5", "S2", "H9", "H8", "H6", "D10", "D7", "D3", "D2", "C13", "C12", "C8", "C4"],
      ["S12", "S11", "S6", "S4", "H12", "H2", "D14", "D9", "D6", "D4", "C14", "C11", "C10"],
      ["S14", "S13", "S8", "S3", "H11", "H10", "H3", "D13", "D12", "D8", "C9", "C6", "C3"],
      ["S10", "S9", "S7", "H14", "H13", "H7", "H5", "H4", "D11", "D5", "C7", "C5", "C2"],
    ],
  },
  SEATGOLD2: {
    deals: [0, 0, 0],
    outcome: "gameover",
    money: 6,
    ante: 1,
    blindIdx: 0,
    runScore: 0,
    hands: [
      ["S13", "S12", "S5", "H13", "H4", "H2", "D11", "D10", "D9", "D6", "C11", "C8", "C7"],
      ["S10", "S9", "S8", "H14", "H12", "H5", "D14", "D8", "D5", "D2", "C14", "C10", "C5"],
      ["S14", "S11", "S7", "H9", "H7", "H3", "D13", "D12", "D7", "D4", "C13", "C6", "C3"],
      ["S6", "S4", "S3", "S2", "H11", "H10", "H8", "H6", "D3", "C12", "C9", "C4", "C2"],
    ],
  },
  SEATGOLD3: {
    deals: [689, 0, 0, 671],
    outcome: "gameover",
    money: 14,
    ante: 1,
    blindIdx: 1,
    runScore: 689,
    hands: [
      ["S13", "S12", "S11", "S10", "H12", "H10", "H6", "D14", "D12", "D5", "D2", "C12", "C10"],
      ["S7", "S6", "S5", "H9", "H5", "H2", "D7", "D4", "D3", "C14", "C9", "C3", "C2"],
      ["S8", "S4", "S3", "S2", "H4", "D13", "D11", "D8", "C13", "C11", "C8", "C6", "C5"],
      ["S14", "S9", "H14", "H13", "H11", "H8", "H7", "H3", "D10", "D9", "D6", "C7", "C4"],
    ],
  },
};

/* Fifty runs, so a change too small to move any one seed still moves this.

   Re-recorded when this branch was rebased onto a main carrying the Pakkonolo
   and Temppukielto bosses. Both change what a run scores, so the figure taken
   before them was stale by one flipped outcome and 207 points. The number below
   was read off main itself, immediately before this commit applied, and the
   rebased build reproduces it exactly — which is the whole assertion: the two
   bosses moved the runs, the seat-absolute change moved nothing. The three
   named seeds above needed no re-recording; neither boss rolls in their four
   blinds. */
const AGGREGATE = { sum: 267752, victory: 0, gameover: 37, limit: 13 };

describe("the engine's output is what it was", () => {
  it.each(NAMED)("plays %s exactly as the pre-change build did", (seed) => {
    const want = GOLDEN[seed];
    const r = playRun(seed, basicPolicy, 4);
    expect(r.deals).toEqual(want.deals);
    expect(r.outcome).toBe(want.outcome);
    expect(econOf(r.state, 0).money).toBe(want.money);
    expect(r.state.ante).toBe(want.ante);
    expect(r.state.blindIdx).toBe(want.blindIdx);
    expect(r.state.runScore).toBe(want.runScore);

    const dealt = advance(gameReducer(createRun(seed), { type: "startBlind" }));
    expect(dealt.hands.map((h) => h.map((c) => c.id))).toEqual(want.hands);
  });

  it("scores and ends fifty seeds exactly as the pre-change build did", () => {
    const agg = { sum: 0, victory: 0, gameover: 0, limit: 0 };
    for (let i = 0; i < 50; i++) {
      const r = playRun(`SEAT${i}`, basicPolicy, 4);
      for (const d of r.deals) agg.sum += d;
      agg[r.outcome]++;
    }
    expect(agg).toEqual(AGGREGATE);
  });
});

/* ==================== a whole blind from another chair ====================
   The rotation below drives one deal by hand. This drives four through the
   real bot instead, from a seat the lobby could have picked, because that is
   the path a reducer guard hardcoded to seat 0 would stall on: playToScreen
   asks ownerSeat for the seat to act as, so a case that refused it would leave
   the phase where it was and the loop would never settle.

   Both teams are covered — seat 3 and seat 1 — because the shell is banked for
   the owner's team, and a team-indexed mistake would show on only one of the
   two. */
/* Every deal of a blind, from the start of the first to whatever screen ends
   it, asserting thirteen tricks each time. */
function playBlindOut(seed: string, seat: Seat): GameState {
  let s = playBlind(createRun(seed, 0, seat));
  for (let guard = 0; guard < 8; guard++) {
    expect(s.screen, `the deal stalled with the human at seat ${seat}`).not.toBeNull();
    expect(s.tricks[0] + s.tricks[1]).toBe(13);
    expect(s.hands[seat]).toHaveLength(0);
    if (s.screen?.kind !== "dealend") return s;
    s = playToScreen(advance(gameReducer(s, { type: "nextDeal" })));
  }
  throw new Error("the blind did not end");
}

describe("a blind plays from a seat that is not 0", () => {
  it.each([3, 1] as const)("plays every deal out with the human at seat %s", (seat) => {
    const s = playBlindOut("LOBBY1", seat);
    expect(["cashout", "gameover"]).toContain(s.screen?.kind);
    /* Three empty purses, whichever chair the human took: the shell belongs to
       the run's owner and to nobody else. */
    for (const p of [0, 1, 2, 3] as const)
      if (p !== seat) expect(econOf(s, p)).toEqual(newEconomy());
  });

  /* A seed whose blind the bot clears at every seat, so there is a cash-out to
     credit: LOBBY1 above dies at seats 1 and 3, which is a real difference
     between the chairs — the seat decides which hand a seed deals you — and
     leaves no money to follow. */
  it.each([3, 1] as const)("banks the blind into seat %s's own wallet", (seat) => {
    const end = playBlindOut("LOBBY6", seat);
    expect(end.screen?.kind).toBe("cashout");
    const s = advance(gameReducer(end, { type: "toShop" }));
    expect(econOf(s, seat)).not.toEqual(newEconomy());
    expect(econOf(s, seat).money).toBeGreaterThan(newEconomy().money);
    for (const p of [0, 1, 2, 3] as const)
      if (p !== seat) expect(econOf(s, p)).toEqual(newEconomy());
  });
});

/* ==================== the rotation ====================
   The same deal, with the human at each of the four seats in turn.

   The bot has to *mirror* the opponents, not play its own game: a policy with
   its own opinions would make four different games out of the four seatings
   and their scores would legitimately differ. This policy returns exactly what
   aiDeclare and chooseAI would return for the seat it is asked about, so all
   four configurations play the identical thirteen tricks and any difference is
   the bug the test is looking for.

   chooseAI takes an Rng, and the run's own generator is not it: the reducer
   draws from g.rngState for an AI seat and a human seat's playCard draws
   nothing. The fixture is pinned to the paths where chooseAI never draws — no
   boss (so no umpimahka) and the sooli declined (the anti-sooli lead is the
   other draw) — so the throwaway cursor here is never consumed. The rngState
   assertion below is the tripwire if that ever stops being true. */
const mirroring: Policy = {
  declare: (g, p) => aiDeclare(g, p),
  chooseCard: (g, p) => chooseAI(g, p, makeRng(0)).uid,
  playSooli: () => false,
  sooliGive: (g, p) => g.hands[p][0].uid,
  swap: () => null,
  laydown: (g, p) => chooseLaydown(g, teamOf(p)),
};

const SEED = "ROTATE";
const SEATS: Seat[] = [0, 1, 2, 3];

type Deal = {
  winners: Seat[];
  tricks: [number, number];
  mode: GameState["mode"];
  ramSeat: Seat | null;
  ramTeam: 0 | 1 | null;
  leader: Seat;
  rngState: number;
  handScore: number;
};

/* One deal, driven by hand rather than through playToScreen: the winner of
   each trick has to be read while it is on the table, and `act` advances
   straight past it. */
function playFirstDeal(human: Seat): Deal {
  const seats: GameState["seats"] = ["ai", "ai", "ai", "ai"];
  seats[human] = "human";
  let s: GameState = { ...createRun(SEED), seats };
  s = gameReducer(s, { type: "startBlind" });

  const winners: Seat[] = [];
  for (let guard = 0; guard < 4000; guard++) {
    if (s.screen) break;
    const tick = nextTick(s);
    if (tick) {
      /* winSeat is set by resolveTrick and cleared by endTrick, so trickend
         with a pending tick is exactly once per trick. */
      if (s.phase === "trickend" && s.winSeat !== null) winners.push(s.winSeat);
      s = gameReducer(s, tick.action);
      continue;
    }
    /* nextTick returned null: the human seat owes a move. */
    switch (s.phase) {
      case "declare":
        s = gameReducer(s, { type: "declare", p: human, decl: mirroring.declare(s, human) });
        break;
      case "soolioffer":
        s = gameReducer(s, { type: "declineSooli", p: human });
        break;
      case "play":
        s = gameReducer(s, {
          type: "playCard",
          p: human,
          uid: mirroring.chooseCard(s, human),
        });
        break;
      default:
        throw new Error(`the rotation bot has no move for phase ${s.phase}`);
    }
  }
  if (!s.screen) throw new Error("the deal did not reach a screen");
  return {
    winners,
    tricks: [s.tricks[0], s.tricks[1]],
    mode: s.mode,
    ramSeat: s.ramSeat,
    ramTeam: s.ramTeam,
    leader: s.leader,
    rngState: s.rngState,
    handScore: s.handScore,
  };
}

describe("the same deal from any seat", () => {
  const deals = SEATS.map(playFirstDeal);
  const [k0, k1, k2, k3] = deals;

  /* A vacuous pass would be the worst outcome here: if the fixture never got
     past the declaration there would be nothing to compare. */
  it("plays a full thirteen tricks in every configuration", () => {
    for (const d of deals) {
      expect(d.winners).toHaveLength(13);
      expect(d.tricks[0] + d.tricks[1]).toBe(13);
    }
  });

  it("gives the identical sequence of thirteen winning seats", () => {
    expect(k1.winners).toEqual(k0.winners);
    expect(k2.winners).toEqual(k0.winners);
    expect(k3.winners).toEqual(k0.winners);
  });

  it("splits the tricks identically between the two teams", () => {
    for (const d of deals) expect(d.tricks).toEqual(k0.tricks);
  });

  it("reaches the same declaration, declarer, team and opening lead", () => {
    for (const d of deals) {
      expect(d.mode).toBe(k0.mode);
      expect(d.ramSeat).toBe(k0.ramSeat);
      expect(d.ramTeam).toBe(k0.ramTeam);
      expect(d.leader).toBe(k0.leader);
    }
  });

  /* A divergence here means the human-driven seat consumed randomness the
     AI-driven seat did not — the mirroring policy reached a chooseAI branch
     that draws from the run's own generator, which the fixture is pinned to
     avoid. That is a real defect, not a flaky test. */
  it("leaves the generator in the same place, so no seat drew what another did not", () => {
    for (const d of deals)
      expect(
        d.rngState,
        "a seat consumed randomness another did not: chooseAI drew from the run's Rng",
      ).toBe(k0.rngState);
  });

  /* The run's shell — money, target, banked score — belongs to one team, so
     the deal is banked for the human's team. Seats 0 and 2 are one team and
     1 and 3 the other, which is the comparison that is meaningful. */
  it("banks the same deal score within a partnership", () => {
    expect(k2.handScore).toBe(k0.handScore);
    expect(k3.handScore).toBe(k1.handScore);
    expect(teamOf(0)).toBe(teamOf(2));
    expect(teamOf(1)).toBe(teamOf(3));
    expect(partnerOf(0)).toBe(2);
    expect(partnerOf(1)).toBe(3);
  });
});
