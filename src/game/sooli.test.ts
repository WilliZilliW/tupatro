import { describe, expect, it } from "vitest";
import { chooseSooliGive, shouldSooli } from "./ai";
import { makeDeck, makeMint, rv } from "./cards";
import { partnerOf, teamOf } from "./constants";
import { gameReducer, declOrder } from "./reducer";
import { legalCards, sooliCandidates, trickSize } from "./rules";
import { nextTick, waitingSeat } from "./schedule";
import { card, st } from "../test/factories";
import type { Action } from "./actions";
import type { GameState, Seat, SeatKind, Suit } from "./types";

const SEATS: Seat[] = [0, 1, 2, 3];
const PHASES = ["soolioffer", "sooligive", "sooliready"] as const;
const ROTATIONS = SEATS.flatMap((dealer) => SEATS.map((p) => ({ dealer, p })));

describe.each(["race", "tuppi"] as const)("%s sooli", (challenge) => {
  function declaration(dealer: Seat, ram: Seat, seats: GameState["seats"]): GameState {
    const deck = makeDeck(makeMint(0));
    return st({
      challenge,
      screen: null,
      phase: "declare",
      dealer,
      declSeq: declOrder(dealer),
      declIdx: 4,
      seats,
      shows: SEATS.map((p) => ({
        decl: p === ram ? "rami" : "nolo",
        card: null,
      })) as GameState["shows"],
      hands: SEATS.map((p) => deck.slice(13 * p, 13 * (p + 1))) as GameState["hands"],
    });
  }

  function offer(dealer: Seat, p: Seat, kind: SeatKind, mateKind: SeatKind): GameState {
    const ram = ((p + 1) % 4) as Seat;
    const seats: GameState["seats"] = ["human", "human", "human", "human"];
    seats[p] = kind;
    seats[partnerOf(p)] = mateKind;
    return gameReducer(declaration(dealer, ram, seats), { type: "finishDeclare" });
  }

  function lowHand(): GameState["hands"][number] {
    return (["S", "H", "C", "D"] as Suit[]).flatMap((s) =>
      (s === "S" ? [14, 2, 4, 5] : [14, 2, 4]).map((r) => card(s, r)),
    );
  }

  function withHand(g: GameState, p: Seat, hand: GameState["hands"][number]): GameState {
    return { ...g, hands: g.hands.map((h, i) => (i === p ? hand : h)) as GameState["hands"] };
  }

  function tick(g: GameState): GameState {
    const next = nextTick(g);
    expect(next).not.toBeNull();
    return gameReducer(g, next!.action);
  }

  describe("match sooli candidates", () => {
    it.each(ROTATIONS)("puts human $p first with dealer $dealer", ({ dealer, p }) => {
      const g = offer(dealer, p, "human", "ai");
      expect(sooliCandidates(g)).toEqual([p, partnerOf(p)]);
      expect(g.phase).toBe("soolioffer");
      expect(g.sooliSeat).toBe(p);
      expect(waitingSeat(g)).toBe(p);
      expect(nextTick(g)).toBeNull();
      expect(teamOf(p)).not.toBe(g.ramTeam);
    });

    describe.each(["human", "ai"] as const)("two %s defenders", (kind) => {
      it.each(ROTATIONS)("uses dealer $dealer order for defender $p", ({ dealer, p }) => {
        let g = offer(dealer, p, kind, kind);
        const clockwise = [1, 2, 3, 4].map((offset) => ((dealer + offset) % 4) as Seat);
        const expected = clockwise.filter((seat) => seat === p || seat === partnerOf(p));
        expect(sooliCandidates(g)).toEqual(expected);
        expect(g.sooliSeat).toBe(expected[0]);
        const pass = (state: GameState) =>
          kind === "human"
            ? gameReducer(state, { type: "declineSooli", p: state.sooliSeat! })
            : tick(state);
        /* Each fixture hand has four high cards, so both bots decline. */
        const before = g.rngState;
        g = pass(g);
        expect(g.phase).toBe("soolioffer");
        expect(g.sooliSeat).toBe(expected[1]);
        g = pass(g);
        expect(g.phase).toBe("play");
        expect(g.sooliSeat).toBeNull();
        expect(g.sooli).toBe(false);
        expect(g.mode).toBe("rami");
        expect(g.turn).toBe((g.ramSeat! + 3) % 4);
        expect(g.rngState).toBe(before);
      });
    });

    it.each([null] as const)("preserves the single human offer in the main game", (challenge) => {
      for (const { dealer, p } of ROTATIONS) {
        const g = {
          ...declaration(dealer, ((p + 1) % 4) as Seat, ["human", "human", "human", "human"]),
          challenge,
        };
        const expected = Math.min(p, partnerOf(p));
        const first = gameReducer(g, { type: "finishDeclare" });
        expect(sooliCandidates(first)).toEqual([expected]);
        expect(first.sooliSeat).toBe(expected);
        const after = gameReducer(first, { type: "declineSooli", p: expected as Seat });
        expect(after.phase).toBe("play");
        /* Legacy state is preserved too, not just its visible behavior. */
        expect(after.sooliSeat).toBe(expected);
        const ai = {
          ...g,
          seats: SEATS.map((seat) =>
            teamOf(seat) === teamOf(p) ? "ai" : "human",
          ) as GameState["seats"],
        };
        expect(gameReducer(ai, { type: "finishDeclare" }).phase).toBe("play");
      }
    });

    it("never offers nolo or an absent declaring team", () => {
      expect(sooliCandidates(st({ challenge, mode: "nolo" }))).toEqual([]);
      expect(sooliCandidates(st({ challenge, ramTeam: null }))).toEqual([]);
      const g = declaration(3, 0, ["human", "human", "human", "human"]);
      g.shows = SEATS.map(() => ({ decl: "nolo", card: null })) as GameState["shows"];
      const after = gameReducer(g, { type: "finishDeclare" });
      expect(after.mode).toBe("nolo");
      expect(after.phase).toBe("play");
      expect(after.sooliSeat).toBeNull();
    });
  });

  describe("sequential responses and stale actions", () => {
    it.each(ROTATIONS)(
      "lets the second human accept with dealer $dealer and defender $p",
      ({ dealer, p }) => {
        const first = offer(dealer, p, "human", "human");
        const a = first.sooliSeat!;
        const b = partnerOf(a);
        const pass: Action = { type: "declineSooli", p: a };
        const second = gameReducer(first, pass);
        expect(gameReducer(second, pass)).toBe(second);
        expect(gameReducer(second, { type: "acceptSooli", p: a })).toBe(second);
        const accepted = gameReducer(second, { type: "acceptSooli", p: b });
        expect(accepted.phase).toBe("sooligive");
        expect(accepted.sooliSeat).toBe(b);
        expect(accepted.sooli).toBe(true);
        for (const seat of SEATS) {
          expect(gameReducer(accepted, { type: "acceptSooli", p: seat })).toBe(accepted);
          expect(gameReducer(accepted, { type: "declineSooli", p: seat })).toBe(accepted);
        }
        expect(gameReducer(accepted, { type: "finishDeclare" })).toBe(accepted);
        const give: Action = { type: "sooliGive", p: b, uid: accepted.hands[b][0].uid };
        const ready = gameReducer(accepted, give);
        expect(ready.phase).toBe("sooliready");
        expect(ready.hands[b]).toHaveLength(13);
        expect(ready.hands[a]).toHaveLength(0);
        expect(gameReducer(ready, give)).toBe(ready);
        const playing = gameReducer(ready, { type: "startSooliPlay", p: b });
        expect(playing.phase).toBe("play");
        expect(gameReducer(playing, { type: "startSooliPlay", p: b })).toBe(playing);
      },
    );

    it.each(SEATS)("refuses every wrong human actor and phase for seat %i", (p) => {
      const first = offer(3, p, "human", "ai");
      const accepted = gameReducer(first, { type: "acceptSooli", p });
      const ready = gameReducer(accepted, { type: "sooliGive", p, uid: accepted.hands[p][0].uid });
      const actions: Action[] = [
        { type: "acceptSooli", p },
        { type: "declineSooli", p },
        { type: "sooliGive", p, uid: accepted.hands[p][0].uid },
        { type: "startSooliPlay", p },
      ];
      for (const g of [first, accepted, ready]) {
        for (const a of actions) {
          for (const wrong of SEATS.filter((seat) => seat !== p))
            expect(gameReducer(g, { ...a, p: wrong } as Action)).toBe(g);
          const ai = {
            ...g,
            seats: g.seats.map((kind, seat) => (seat === p ? "ai" : kind)) as GameState["seats"],
          };
          expect(gameReducer(ai, a)).toBe(ai);
          const outside = { ...g, phase: "play" as const };
          expect(gameReducer(outside, a)).toBe(outside);
        }
      }
      expect(gameReducer(accepted, { type: "sooliGive", p, uid: "missing" })).toBe(accepted);
      const emptyMate = withHand(accepted, partnerOf(p), []);
      expect(gameReducer(emptyMate, { type: "sooliGive", p, uid: accepted.hands[p][0].uid })).toBe(
        emptyMate,
      );
    });
  });

  describe("own-hand AI policy", () => {
    it.each([14, 2, 3])(
      "accepts a %i low guard in every occupied suit with at most one high card",
      (guard) => {
        const hand = (["S", "H", "C", "D"] as Suit[]).map((s) => card(s, guard));
        const g = withHand(st(), 2, [...hand, card("S", 13)]);
        expect(shouldSooli(g, 2)).toBe(true);
        expect(shouldSooli(withHand(g, 2, [...g.hands[2], card("H", 10)]), 2)).toBe(false);
      },
    );

    it("requires each occupied suit's guard, not just a low card somewhere", () => {
      const g = withHand(st(), 1, [card("S", 14), card("S", 2), card("H", 4)]);
      expect(shouldSooli(g, 1)).toBe(false);
      expect(shouldSooli(withHand(g, 1, [card("S", 14), card("S", 4)]), 1)).toBe(true);
      expect(shouldSooli(st(), 1)).toBe(false);
    });

    it.each(SEATS)("reads only seat %i's hand and mutates nothing", (p) => {
      const hand = Object.freeze(lowHand());
      const hands = SEATS.map((seat) => (seat === p ? hand : [])) as GameState["hands"];
      for (const seat of SEATS.filter((seat) => seat !== p))
        Object.defineProperty(hands, seat, {
          get: () => {
            throw new Error("hidden hand read");
          },
        });
      const g = { hands };
      expect(shouldSooli(g, p)).toBe(true);
      expect(chooseSooliGive(g, p)?.r).toBe(5);
    });

    it("discards the highest sooli rank, keeping aces low and ties stable", () => {
      const firstKing = card("C", 13);
      const hand = [card("S", 14), firstKing, card("H", 13), card("D", 2)];
      const g = withHand(st(), 0, hand);
      expect(chooseSooliGive(g, 0)).toBe(firstKing);
      expect(g.hands[0]).toEqual(hand);
      expect(chooseSooliGive(st(), 0)).toBeNull();
    });
  });

  describe("AI sooli clock", () => {
    it.each(ROTATIONS)(
      "finishes each AI stage for seat $p with dealer $dealer",
      ({ dealer, p }) => {
        const humanFirst = offer(dealer, p, "ai", "human");
        const first = withHand(humanFirst, p, lowHand());
        expect(first.sooliSeat).toBe(partnerOf(p));
        const offered = gameReducer(first, { type: "declineSooli", p: partnerOf(p) });
        const offerTick = nextTick(offered)!;
        expect(offerTick.action).toEqual({ type: "aiSooli", p, phase: "soolioffer" });
        const accepted = tick(offered);
        expect(accepted.phase).toBe("sooligive");
        expect(accepted.rngState).toBe(offered.rngState);
        expect(gameReducer(accepted, offerTick.action)).toBe(accepted);
        const giveTick = nextTick(accepted)!;
        const ready = tick(accepted);
        expect(ready.phase).toBe("sooliready");
        expect(ready.hands[p]).toHaveLength(13);
        expect(ready.hands[partnerOf(p)]).toEqual([]);
        expect(ready.sooliExchange?.gave.r).toBe(5);
        expect(accepted.hands[partnerOf(p)]).toContainEqual(ready.sooliExchange?.got);
        expect(ready.hands[p]).toContainEqual(ready.sooliExchange?.got);
        expect(ready.hands[p]).not.toContainEqual(ready.sooliExchange?.gave);
        expect(ready.rngState).not.toBe(accepted.rngState);
        expect(tick(accepted)).toEqual(ready);
        expect(gameReducer(ready, giveTick.action)).toBe(ready);
        const readyTick = nextTick(ready)!;
        expect(new Set([offerTick.key, giveTick.key, readyTick.key]).size).toBe(3);
        const playing = tick(ready);
        expect(playing.phase).toBe("play");
        expect(playing.sooliOrder).toEqual([playing.ramSeat, partnerOf(playing.ramSeat!), p]);
        expect(playing.turn).toBe(playing.ramSeat);
        expect(trickSize(playing)).toBe(3);
        expect(rv(playing, card("H", 14))).toBe(1);
        expect(gameReducer(playing, readyTick.action)).toBe(playing);
        for (const state of [offered, accepted, ready]) {
          expect(waitingSeat(state)).toBeNull();
          for (const wrong of SEATS.filter((seat) => seat !== p))
            expect(gameReducer(state, { ...nextTick(state)!.action, p: wrong } as Action)).toBe(
              state,
            );
        }
      },
    );

    it("gives the second bot a distinct tick and lets it accept after the first declines", () => {
      const first = withHand(offer(3, 1, "ai", "ai"), 3, lowHand());
      expect(first.sooliSeat).toBe(1);
      const a = nextTick(first)!;
      const second = tick(first);
      expect(second.sooliSeat).toBe(3);
      expect(nextTick(second)!.key).not.toBe(a.key);
      expect(gameReducer(second, a.action)).toBe(second);
      expect(tick(second).phase).toBe("sooligive");
    });

    it.each(PHASES)("waits for humans and keeps legacy clocks idle in %s", (phase) => {
      for (const p of SEATS) {
        const human = { ...offer(3, p, "human", "ai"), phase };
        expect(nextTick(human)).toBeNull();
        expect(waitingSeat(human)).toBe(p);
        const a: Action = { type: "aiSooli", p, phase };
        expect(gameReducer(human, a)).toBe(human);
        const ai = { ...offer(3, p, "ai", "ai"), phase, sooliSeat: p };
        expect(nextTick(ai)).not.toBeNull();
        expect(nextTick({ ...ai, menu: "start" })).toBeNull();
        expect(nextTick({ ...ai, sooliSeat: null })).toBeNull();
        for (const challenge of [null, "rummikub"] as const) {
          const other = { ...ai, challenge };
          expect(nextTick(other)).toBeNull();
          expect(gameReducer(other, a)).toBe(other);
        }
      }
    });

    it("plays an accepted AI sooli through real tricks and preserves each mode's banking", () => {
      const deck = makeDeck(makeMint(0));
      const lowFaces = new Set(lowHand().map((c) => c.id));
      const solo = deck.filter((c) => lowFaces.has(c.id));
      const rest = deck.filter((c) => !lowFaces.has(c.id));
      const base = offer(3, 1, "ai", "ai");
      const start: GameState = {
        ...base,
        hands: [rest.slice(0, 13), solo, rest.slice(13, 26), rest.slice(26)],
      };
      const play = (raceScores: GameState["raceScores"]) => {
        let g: GameState = { ...start, raceScores };
        const seen = new Set<string>();
        for (let i = 0; i < 300 && !g.screen; i++) {
          seen.add(g.phase);
          const auto = nextTick(g);
          if (auto) g = gameReducer(g, auto.action);
          else {
            expect(g.phase).toBe("play");
            const p = waitingSeat(g)!;
            g = gameReducer(g, { type: "playCard", p, uid: legalCards(g, p)[0].uid });
          }
          if (g.phase === "resolve") {
            expect(g.trick).toHaveLength(3);
            expect(g.trick[2].p).toBe(1);
            expect(g.trick.some((t) => t.p === 3)).toBe(false);
          }
        }
        expect([...seen]).toEqual(
          expect.arrayContaining([...PHASES, "play", "resolve", "trickend", "handend"]),
        );
        expect(g.screen).not.toBeNull();
        expect(g.sooli).toBe(true);
        expect(g.trickNo).toBeGreaterThan(0);
        expect(g.sooliBust || g.trickNo === 13).toBe(true);
        return g;
      };
      const result = play([0, 0]);
      const winner = result.sooliBust ? 0 : 1;
      if (challenge === "tuppi") {
        expect(result.raceScores[winner]).toBe(24);
        expect(result.raceScores[1 - winner]).toBe(0);
        const reset = play(winner === 0 ? [0, 12] : [12, 0]);
        expect(reset.raceScores).toEqual([0, 0]);
        expect(reset.handScore).toBe(0);
      } else {
        if (result.sooliBust) expect(result.raceScores).toEqual([0, 0]);
        else {
          expect(result.raceScores[0]).toBe(0);
          expect(result.raceScores[1]).toBe(6 * result.raceBase[1]);
          expect(result.raceScores[1]).toBeGreaterThan(0);
        }
        const cumulative = play([120, 240]);
        expect(cumulative.raceScores).toEqual([
          120 + result.raceScores[0],
          240 + result.raceScores[1],
        ]);
        expect(cumulative.handScore).toBe(result.handScore);
      }
      expect(play([0, 0])).toEqual(result);
    });
  });
});
