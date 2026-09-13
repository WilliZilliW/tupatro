import { describe, expect, it } from "vitest";
import { NET_VERSION, encodeMsg, hashState } from "./protocol";
import { guestSession, hostSession, type GuestSession, type HostSession } from "./session";
import { basicPolicy } from "../test/bot";
import { makeDeck, makeMint } from "../game/cards";
import { gameReducer } from "../game/reducer";
import { makeRng } from "../game/rng";
import { nextTick } from "../game/schedule";
import { createRun } from "../game/state";
import { dehydrate } from "../game/save";
import type { Action } from "../game/actions";
import type { GameState, Seat } from "../game/types";

/* Two peers, wired to each other, each running its own reducer over its own
   state. This is the whole of what the transport has to get right: after the
   same clicks, the two states must be the same state. */

const TABLE: GameState["seats"] = ["human", "human", "ai", "ai"];
const GUEST_SEAT: Seat = 1;

type Wired = {
  state: { host: GameState; guest: GameState };
  host: HostSession;
  guest: GuestSession;
  status: { host: string[]; guest: string[] };
  sent: { toGuest: number; toHost: number };
  guests: Array<[string, string, Seat | null]>;
  hold: (on: boolean) => void;
  flush: () => void;
};

function wire(): Wired {
  const state = { host: createRun("BOOT"), guest: createRun("BOOT") };
  const status = { host: [] as string[], guest: [] as string[] };
  const sent = { toGuest: 0, toHost: 0 };
  const guests: Array<[string, string, Seat | null]> = [];
  const held = { on: false, toGuest: [] as string[], toHost: [] as string[] };
  const at: { host?: HostSession; guest?: GuestSession } = {};

  const host = hostSession({
    send: (peer, text) => {
      /* Only the player guest is wired here; a second peer's traffic is the
         three-peer case's business. */
      if (peer !== "g1") return;
      sent.toGuest++;
      if (held.on) held.toGuest.push(text);
      else at.guest?.receive(text);
    },
    apply: (a) => {
      state.host = gameReducer(state.host, a);
      /* The window hands the hash in on the render that follows; here the
         apply is synchronous, so this is that render. */
      at.host?.localHash(hashState(state.host));
    },
    onStatus: (s, info) => status.host.push(info ? `${s}:${info}` : s),
    onGuest: (peer, as, chair) => guests.push([peer, as, chair]),
  });
  const guest = guestSession({
    as: "player",
    send: (_peer, text) => {
      sent.toHost++;
      if (held.on) held.toHost.push(text);
      else at.host?.receive("g1", text);
    },
    apply: (a) => {
      state.guest = gameReducer(state.guest, a);
      at.guest?.localHash(hashState(state.guest));
    },
    onStatus: (s, info) => status.guest.push(info ? `${s}:${info}` : s),
    onSeat: () => {},
  });
  at.host = host;
  at.guest = guest;
  host.join("g1", GUEST_SEAT);
  guest.hello();

  return {
    state,
    host,
    guest,
    status,
    sent,
    guests,
    hold: (on) => {
      held.on = on;
    },
    flush: () => {
      held.on = false;
      for (const t of held.toGuest.splice(0)) guest.receive(t);
      for (const t of held.toHost.splice(0)) host.receive("g1", t);
    },
  };
}

/* The clock, exactly as useGameLoop runs it: on every peer. The host's ticks
   become numbered actions; the guest's are dropped by the classifier, which
   is why the loop needs no idea a session exists. */
function tickAll(w: Wired): void {
  for (let i = 0; i < 4000; i++) {
    const g = nextTick(w.state.guest);
    if (g) w.guest.intent(g.action);
    const h = nextTick(w.state.host);
    if (!h) return;
    w.host.intent(h.action);
  }
  throw new Error("the clock did not settle");
}

/* Which human seat the deal is waiting for, or null. */
function waiting(g: GameState): Seat | null {
  const human = (p: Seat | null | undefined) =>
    p !== null && p !== undefined && g.seats[p] === "human" ? p : null;
  switch (g.phase) {
    case "swap":
      return human(0);
    case "declare":
      return g.declIdx < 4 ? human(g.declSeq[g.declIdx]) : null;
    case "soolioffer":
    case "sooligive":
    case "sooliready":
      return human(g.sooliSeat);
    case "play":
      return human(g.turn);
    default:
      return null;
  }
}

function move(g: GameState, p: Seat): Action {
  switch (g.phase) {
    case "swap":
      return { type: "finishSwap", p };
    case "declare":
      return { type: "declare", p, decl: basicPolicy.declare(g, p) };
    case "soolioffer":
      return { type: "declineSooli", p };
    case "sooligive":
      return { type: "sooliGive", p, uid: basicPolicy.sooliGive(g, p) };
    case "sooliready":
      return { type: "startSooliPlay", p };
    case "play":
      return { type: "playCard", p, uid: basicPolicy.chooseCard(g, p) };
    default:
      throw new Error(`no move for ${g.phase}`);
  }
}

/* Plays from the host's point of view until a screen opens: every decision is
   routed to the peer whose seat it is. */
function playBlind(w: Wired): void {
  w.host.intent({ type: "startBlind" });
  for (let i = 0; i < 400; i++) {
    tickAll(w);
    if (w.state.host.screen) return;
    const p = waiting(w.state.host);
    if (p === null) throw new Error(`nobody to act in phase ${w.state.host.phase}`);
    (p === GUEST_SEAT ? w.guest : w.host).intent(move(w.state.host, p));
  }
  throw new Error("the blind did not settle");
}

describe("two peers over the relay", () => {
  it("play a whole blind into the same state", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "LOCKSTEP", seats: TABLE });
    expect(w.state.guest.seed).toBe("LOCKSTEP");
    expect(w.state.guest.seats).toEqual(TABLE);

    playBlind(w);

    /* `cashout`, not `dealend`: the blind's target is met on the first deal
       for this seed. Which of the two opens is the policy bot's business — it
       picks by position in the hand it is handed, and the hand layout order
       moved — and what this test is about is that both peers opened the same
       one from the same numbered stream. */
    expect(w.state.host.screen?.kind).toBe("cashout");
    expect(hashState(w.state.guest)).toBe(hashState(w.state.host));
    expect(dehydrate(w.state.guest)).toEqual(dehydrate(w.state.host));
    expect(w.status.host.filter((s) => s.startsWith("desync"))).toEqual([]);
    expect(w.status.guest.filter((s) => s.startsWith("desync"))).toEqual([]);
    /* Vacuity guard: a blind that never reached a trick would agree trivially. */
    expect(w.state.host.trickNo).toBeGreaterThan(5);
    expect(w.host.count()).toBeGreaterThan(50);
  });

  it("apply the host's own intent exactly once", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "ONCE", seats: TABLE });
    w.host.intent({ type: "startBlind" });
    const before = w.host.count();
    const h = hashState(w.state.host);
    w.host.intent({ type: "openModal", modal: "rules" });
    /* A local action is applied and not numbered. */
    expect(w.host.count()).toBe(before);
    expect(hashState(w.state.host)).toBe(h);
    expect(w.state.host.modal).toBe("rules");
  });
});

/* The modes the lobby starts, played across the relay: a match is what the
   transport is for, and startChallenge is the one flow action that builds a
   whole state out of nothing but its own fields. Two humans, one at each peer,
   and thirteen tricks between them.

   Both ids, because the mode rides in that action's own field and nothing in
   protocol.ts was added for it: SCOPE, hashState, parseMsg and guestMay are
   byte-identical, and `challenge`, `raceDeal` and `raceScores` were already
   hashed. A guest that ended up in the other mode would hash differently on
   the first numbered action. */
describe("a match over the relay", () => {
  it.each(
    (["race", "tuppi"] as const).flatMap((id) =>
      (["human", "ai"] as const).flatMap((kind) =>
        (["reorderHand", "setSortMode", "moveCard", "duplicate faces"] as const).map((layout) => ({
          id,
          kind,
          layout,
        })),
      ),
    ),
  )("keeps $id's $kind sooli in lockstep after guest-only $layout", ({ id, kind, layout }) => {
    const w = wire();
    w.host.intent({
      type: "startChallenge",
      id,
      seed: "LOCALSOOLI",
      seats: ["human", "human", "ai", kind],
    });
    const deck = makeDeck(makeMint(0));
    const low = (c: (typeof deck)[number]) =>
      c.r === 14 || c.r === 2 || c.r === 4 || (c.s === "S" && c.r === 5);
    const solo = deck.filter(low);
    const rest = deck.filter((c) => !low(c));
    const ranked = gameReducer(
      { ...w.state.host, hands: [[], rest.slice(13, 26), [], []] },
      { type: "setSortMode", p: 1, mode: "rank" },
    ).hands[1];
    /* A cyclic shift makes rank sorting change every index. Duplicate faces
       deliberately stress identity, not a legal unenhanced match deck. */
    const mate = [...ranked.slice(1), ranked[0]].map((c) =>
      layout === "duplicate faces" ? { ...c, s: ranked[0].s, r: ranked[0].r, id: ranked[0].id } : c,
    );
    const hands: GameState["hands"] = [rest.slice(0, 13), mate, rest.slice(26), solo];
    for (const peer of ["host", "guest"] as const)
      w.state[peer] = {
        ...w.state[peer],
        hands: hands.map((h) => h.slice()) as GameState["hands"],
        phase: "soolioffer",
        mode: "rami",
        ramSeat: 0,
        ramTeam: 0,
        sooliSeat: 1,
        dealer: 3,
        rngState: 1,
      };
    const rng = makeRng(w.state.host.rngState);
    const index = Math.floor(rng.next() * mate.length);
    const expectedUid = mate.map((c) => c.uid).sort()[index];
    const before = hashState(w.state.host);
    const sent = w.sent.toHost;
    const action: Action =
      layout === "setSortMode"
        ? { type: "setSortMode", p: 1, mode: "rank" }
        : layout === "moveCard"
          ? {
              type: "moveCard",
              p: 1,
              uid: mate[index].uid,
              dir: index === mate.length - 1 ? -1 : 1,
            }
          : { type: "reorderHand", p: 1, uids: [...mate.slice(1), mate[0]].map((c) => c.uid) };
    w.guest.intent(action);
    expect(w.sent.toHost).toBe(sent);
    expect(w.state.host.hands[1]).toEqual(mate);
    expect(w.state.guest.hands[1][index].uid).not.toBe(w.state.host.hands[1][index].uid);
    expect(hashState(w.state.host)).toBe(before);
    expect(hashState(w.state.guest)).toBe(before);
    w.guest.intent({ type: "declineSooli", p: 1 });
    expect(w.state.host.sooliSeat).toBe(3);
    expect(w.state.guest.sooliSeat).toBe(3);
    for (const phase of ["soolioffer", "sooligive", "sooliready"] as const) {
      expect(w.state.host.phase).toBe(phase);
      expect(w.state.guest.phase).toBe(phase);
      const hostHand = w.state.host.hands[1];
      const guestHand = w.state.guest.hands[1];
      const hostOrder = hostHand.map((c) => c.uid);
      const guestOrder = guestHand.map((c) => c.uid);
      if (kind === "ai") {
        const tick = nextTick(w.state.host);
        expect(tick?.action).toEqual({ type: "aiSooli", p: 3, phase });
        w.guest.intent(tick!.action);
        w.host.intent(tick!.action);
      } else {
        w.host.intent(
          phase === "soolioffer"
            ? { type: "acceptSooli", p: 3 }
            : phase === "sooligive"
              ? { type: "sooliGive", p: 3, uid: solo.find((c) => c.r === 5)!.uid }
              : { type: "startSooliPlay", p: 3 },
        );
      }
      expect(hostHand.map((c) => c.uid)).toEqual(hostOrder);
      expect(guestHand.map((c) => c.uid)).toEqual(guestOrder);
      if (phase !== "soolioffer") {
        expect(w.state.guest.sooliExchange?.got.uid).toBe(w.state.host.sooliExchange?.got.uid);
        expect(w.state.host.sooliExchange?.got.uid).toBe(expectedUid);
        expect(w.state.guest.sooliExchange?.got.uid).toBe(expectedUid);
        expect(w.state.host.rngState).toBe(rng.state);
        expect(w.state.guest.rngState).toBe(rng.state);
      }
      expect(hashState(w.state.guest)).toBe(hashState(w.state.host));
    }
    expect(w.state.host.phase).toBe("play");
    expect(w.state.host.hands[1]).toEqual([]);
    expect(w.state.guest.hands[1]).toEqual([]);
    for (let i = 0; i < 300 && !w.state.host.screen; i++) {
      tickAll(w);
      expect(hashState(w.state.guest)).toBe(hashState(w.state.host));
      if (w.state.host.screen) break;
      const p = waiting(w.state.host);
      if (p === null) throw new Error(`nobody to act in phase ${w.state.host.phase}`);
      (p === GUEST_SEAT ? w.guest : w.host).intent(move(w.state.host, p));
      expect(hashState(w.state.guest)).toBe(hashState(w.state.host));
    }
    expect(w.state.host.screen).not.toBeNull();
    expect(w.state.host.trickNo).toBeGreaterThan(0);
    expect(w.state.guest.raceScores).toEqual(w.state.host.raceScores);
    expect(w.status.host.filter((s) => s.startsWith("desync"))).toEqual([]);
    expect(w.status.guest.filter((s) => s.startsWith("desync"))).toEqual([]);
  });

  it.each(
    (["race", "tuppi"] as const).flatMap((id) =>
      (["human", "ai"] as const).map((kind) => ({ id, kind })),
    ),
  )("replays $id's second $kind offer, exchange and banking", ({ id, kind }) => {
    const w = wire();
    const seats: GameState["seats"] = ["human", "human", "ai", kind];
    w.host.intent({ type: "startChallenge", id, seed: "WIRESOOLI", seats });
    /* Fix one legal deck at the declaration boundary so this integration
       test exercises acceptance, rather than hoping a seed offers it. */
    const deck = makeDeck(makeMint(0));
    const low = (c: (typeof deck)[number]) =>
      c.r === 14 || c.r === 2 || c.r === 4 || (c.s === "S" && c.r === 5);
    const solo = deck.filter(low);
    const rest = deck.filter((c) => !low(c));
    const hands: GameState["hands"] = [rest.slice(0, 13), rest.slice(13, 26), rest.slice(26), solo];
    w.state.host = { ...w.state.host, hands };
    w.state.guest = { ...w.state.guest, hands };
    /* Dealer 3 starts with seat 0, so its rami is the declarer whatever
       the other three show. Guest 1 gets priority over partner 3. */
    for (let i = 0; i < 8 && w.state.host.phase === "declare"; i++) {
      tickAll(w);
      if (w.state.host.phase !== "declare") break;
      const p = waiting(w.state.host)!;
      (p === GUEST_SEAT ? w.guest : w.host).intent({
        type: "declare",
        p,
        decl: p === 0 ? "rami" : "nolo",
      });
    }
    expect(w.state.host.ramSeat).toBe(0);
    expect(w.state.host.sooliSeat).toBe(1);
    expect(w.state.host.phase).toBe("soolioffer");
    w.guest.intent({ type: "declineSooli", p: 1 });
    expect(w.state.host.sooliSeat).toBe(3);
    expect(w.state.host.phase).toBe("soolioffer");
    expect(w.state.guest).toEqual(w.state.host);
    const beforeStale = w.state.host;
    w.guest.intent({ type: "acceptSooli", p: 1 });
    expect(w.state.host).toBe(beforeStale);

    for (const phase of ["soolioffer", "sooligive", "sooliready"] as const) {
      expect(w.state.host.phase).toBe(phase);
      const auto = nextTick(w.state.host);
      if (kind === "ai") {
        expect(auto?.action).toEqual({ type: "aiSooli", p: 3, phase });
        const sent = w.sent.toHost;
        const guestBefore = w.state.guest;
        w.guest.intent(auto!.action);
        expect(w.sent.toHost).toBe(sent);
        expect(w.state.guest).toBe(guestBefore);
        w.host.intent(auto!.action);
      } else {
        expect(auto).toBeNull();
        const a: Action =
          phase === "soolioffer"
            ? { type: "acceptSooli", p: 3 }
            : phase === "sooligive"
              ? { type: "sooliGive", p: 3, uid: solo.find((c) => c.r === 5)!.uid }
              : { type: "startSooliPlay", p: 3 };
        w.host.intent(a);
      }
      expect(w.state.guest).toEqual(w.state.host);
      expect(hashState(w.state.guest)).toBe(hashState(w.state.host));
    }
    expect(w.state.host.phase).toBe("play");
    expect(w.state.host.hands[1]).toEqual([]);
    expect(w.state.host.hands[3]).toHaveLength(13);
    const atPlay = { ...w.state.host };
    const finish = () => {
      for (let i = 0; i < 300 && !w.state.host.screen; i++) {
        tickAll(w);
        if (w.state.host.screen) break;
        const p = waiting(w.state.host);
        if (p === null) throw new Error(`nobody to act in phase ${w.state.host.phase}`);
        (p === GUEST_SEAT ? w.guest : w.host).intent(move(w.state.host, p));
      }
      expect(w.state.host.screen).not.toBeNull();
      expect(w.state.guest).toEqual(w.state.host);
      expect(w.state.host.trickNo).toBeGreaterThan(0);
    };
    finish();
    const result = w.state.host;
    const winner = w.state.host.sooliBust ? 0 : 1;
    if (id === "tuppi") expect(result.raceScores[winner]).toBe(24);
    else if (result.sooliBust) expect(result.raceScores).toEqual([0, 0]);
    else {
      expect(result.raceScores).toEqual([0, 6 * result.raceBase[1]]);
      expect(result.raceScores[1]).toBeGreaterThan(0);
    }
    /* Replay the actual tricks against existing totals: traditional resets
         a lost lead, while the race adds chips without erasing either pair. */
    const raceScores: GameState["raceScores"] =
      id === "race" ? [120, 240] : winner === 0 ? [0, 12] : [12, 0];
    w.state.host = { ...atPlay, raceScores };
    w.state.guest = { ...atPlay, raceScores };
    finish();
    if (id === "tuppi") {
      expect(w.state.host.raceScores).toEqual([0, 0]);
      expect(w.state.host.handScore).toBe(0);
    } else {
      expect(w.state.host.raceScores).toEqual([
        120 + result.raceScores[0],
        240 + result.raceScores[1],
      ]);
      expect(w.state.host.handScore).toBe(result.handScore);
    }
    expect(w.status.host.filter((s) => s.startsWith("desync"))).toEqual([]);
    expect(w.status.guest.filter((s) => s.startsWith("desync"))).toEqual([]);
  });

  it.each(["race", "tuppi"] as const)(
    "starts a %s by one action and plays it into the same state",
    (id) => {
      const w = wire();
      w.host.intent({ type: "startChallenge", id, seed: "WIREMATCH", seats: TABLE });
      expect(w.state.guest.challenge).toBe(id);
      expect(w.state.guest.target).toBe(w.state.host.target);
      expect(w.state.guest.seats).toEqual(TABLE);
      expect(hashState(w.state.guest)).toBe(hashState(w.state.host));

      for (let i = 0; i < 400 && !w.state.host.screen; i++) {
        tickAll(w);
        if (w.state.host.screen) break;
        const p = waiting(w.state.host);
        if (p === null) throw new Error(`nobody to act in phase ${w.state.host.phase}`);
        (p === GUEST_SEAT ? w.guest : w.host).intent(move(w.state.host, p));
      }

      expect(w.state.host.screen).not.toBeNull();
      expect(w.state.host.challenge).toBe(id);
      expect(w.state.guest.challenge).toBe(id);
      expect(hashState(w.state.guest)).toBe(hashState(w.state.host));
      expect(w.state.guest.raceScores).toEqual(w.state.host.raceScores);
      expect(w.status.host.filter((s) => s.startsWith("desync"))).toEqual([]);
      expect(w.status.guest.filter((s) => s.startsWith("desync"))).toEqual([]);
      /* Vacuity guard: a deal that never reached a trick would agree
         trivially, and a match banking nothing would too. */
      expect(w.state.host.trickNo).toBeGreaterThan(5);
      expect(w.host.count()).toBeGreaterThan(50);
      expect(Math.max(...w.state.host.raceScores)).toBeGreaterThan(0);
    },
  );
});

describe("a guest", () => {
  it("does not move its own state until the numbered action comes back", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "ROUNDTRIP", seats: TABLE });
    w.host.intent({ type: "startBlind" });
    tickAll(w);
    /* Walk to the guest's own declaration. */
    for (let i = 0; i < 8 && waiting(w.state.host) !== GUEST_SEAT; i++) {
      const p = waiting(w.state.host);
      if (p === null) break;
      w.host.intent(move(w.state.host, p));
      tickAll(w);
    }
    expect(waiting(w.state.host)).toBe(GUEST_SEAT);

    const before = hashState(w.state.guest);
    w.hold(true);
    w.guest.intent(move(w.state.guest, GUEST_SEAT));
    expect(hashState(w.state.guest)).toBe(before);
    w.flush();
    expect(hashState(w.state.guest)).not.toBe(before);
    expect(hashState(w.state.guest)).toBe(hashState(w.state.host));
  });

  it("keeps its own window's actions off the wire", () => {
    const w = wire();
    const sent = w.sent.toHost;
    w.guest.intent({ type: "openModal", modal: "rules" });
    expect(w.sent.toHost).toBe(sent);
    expect(w.state.guest.modal).toBe("rules");
    expect(w.state.host.modal).toBeNull();
  });

  it("drops its own clock rather than sending it", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "CLOCK", seats: TABLE });
    w.host.intent({ type: "startBlind" });
    const sent = w.sent.toHost;
    const h = hashState(w.state.guest);
    w.guest.intent({ type: "aiDeclare" });
    w.guest.intent({ type: "resolveTrick" });
    expect(w.sent.toHost).toBe(sent);
    expect(hashState(w.state.guest)).toBe(h);
  });

  it("cannot act for a seat that is not its own", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "FORGE", seats: TABLE });
    w.host.intent({ type: "startBlind" });
    const n = w.host.count();
    const h = hashState(w.state.host);
    /* Seat 0 is the host's chair. The reducer would refuse an illegal card
       anyway; the point is that the request never becomes an action. */
    w.guest.intent({ type: "declare", p: 0, decl: "rami" });
    expect(w.host.count()).toBe(n);
    expect(hashState(w.state.host)).toBe(h);
  });

  it("stops on a gap in the numbered stream rather than applying past it", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "GAP", seats: TABLE });
    const h = hashState(w.state.guest);
    w.guest.receive(encodeMsg({ t: "act", n: 99, a: { type: "startBlind" } }));
    expect(w.status.guest.some((s) => s.startsWith("desync"))).toBe(true);
    expect(hashState(w.state.guest)).toBe(h);
    /* And it stays stopped: applying the rest would move the divergence away
       from where it happened. */
    w.host.intent({ type: "startBlind" });
    expect(hashState(w.state.guest)).toBe(h);
  });
});

describe("the host", () => {
  it("keeps room players unassigned until the host seats them", () => {
    const w = wire();
    w.host.openLobby("Host");
    w.host.wait("g2");
    w.host.receive("g2", encodeMsg({ t: "hello", v: NET_VERSION, as: "player", name: "Guest" }));

    expect(w.host.lobby()).toEqual([
      { id: "host", name: "Host", seat: null },
      { id: "g2", name: "Guest", seat: null },
    ]);
    expect(w.host.canStart()).toBe(false);
    expect(w.host.assign("host", 0)).toBe(true);
    expect(w.host.assign("g2", 2)).toBe(true);
    expect(w.host.canStart()).toBe(true);
    expect(w.host.seatOf("g2")).toBe(2);
  });

  it("moves players without allowing two in one chair", () => {
    const w = wire();
    w.host.openLobby("Host");
    w.host.wait("g2");
    w.host.receive("g2", encodeMsg({ t: "hello", v: NET_VERSION, as: "player", name: "Guest" }));
    expect(w.host.assign("host", 1)).toBe(true);
    expect(w.host.assign("g2", 1)).toBe(false);
    expect(w.host.assign("g2", 3)).toBe(true);
    expect(w.host.assign("g2", null)).toBe(true);
    expect(w.host.seatOf("g2")).toBeNull();
  });

  it("freezes room assignments after the first action", () => {
    const w = wire();
    w.host.openLobby("Host");
    expect(w.host.assign("host", 0)).toBe(true);
    w.host.intent({ type: "startChallenge", id: "race", seed: "FROZEN" });
    expect(w.host.assign("host", 1)).toBe(false);
    expect(w.host.remove("host")).toBe(false);
  });

  it.each(["race", "tuppi"] as const)(
    "rejects the single-human-sooli v3 engine before %s starts",
    (id) => {
      const w = wire();
      w.host.join("old", 3);
      w.host.receive("old", encodeMsg({ t: "hello", v: 3, as: "player" }));
      expect(NET_VERSION).toBe(6);
      expect(w.status.host.some((s) => s.startsWith("version"))).toBe(true);
      expect(w.host.seatOf("old")).toBeUndefined();
      expect(w.guests.some(([peer]) => peer === "old")).toBe(false);
      w.host.intent({ type: "startChallenge", id, seed: "VERSION4", seats: TABLE });
      expect(w.state.host.challenge).toBe(id);
      expect(w.state.guest).toEqual(w.state.host);
    },
  );

  /* The wire shape did not change at v6, and the door still has to refuse v5:
     that build (room names, no chairs assigned yet) still broadcasts a
     numbered leaveChallenge, which a v6 peer would apply against its own
     parked run — and its own req carrying that action is now ignored,
     leaving it stuck on the result screen. */
  it("rejects the broadcast-leave v5 engine", () => {
    const w = wire();
    w.host.join("old", 3);
    w.host.receive("old", encodeMsg({ t: "hello", v: 5, as: "player" }));
    expect(w.status.host.some((s) => s.startsWith("version"))).toBe(true);
    expect(w.host.seatOf("old")).toBeUndefined();
    expect(w.guests.some(([peer]) => peer === "old")).toBe(false);
  });

  it("rejects the cumulative-scoring v2 engine before a traditional match starts", () => {
    const w = wire();
    w.host.join("old", 3);
    /* Literal 2 matters: NET_VERSION - 1 would pass without the rules bump. */
    w.host.receive("old", encodeMsg({ t: "hello", v: 2, as: "player" }));
    expect(w.status.host.some((s) => s.startsWith("version"))).toBe(true);
    expect(w.host.seatOf("old")).toBeUndefined();
    expect(w.guests.some(([peer]) => peer === "old")).toBe(false);
  });

  it("refuses a peer on another version at the door", () => {
    const w = wire();
    w.host.receive("g1", encodeMsg({ t: "hello", v: NET_VERSION + 1, as: "player" }));
    expect(w.status.host.some((s) => s.startsWith("version"))).toBe(true);
  });

  /* A peer told `bye` is out, and being out means out of the broadcast set:
     it was in it because the chair was set aside before the hello could be
     judged — on the manual route when the channel opened, in a room when the
     hello claimed a chair. Left in, it goes on receiving every numbered
     action, and the room goes on holding a chair for a device that was never
     let in. `late` always did this; the other two did not. */
  it.each([
    ["a version out of step", NET_VERSION + 1, "player", "version"],
    /* And the one that asked for a chair on a link that reserves none. */
    ["asking for a chair it was not offered", NET_VERSION, "player", "nochair"],
  ] as const)("drops a peer refused for %s from the broadcast set", (_label, v, as, why) => {
    const w = wire();
    if (why === "version") w.host.join("g9", 3);
    w.host.receive("g9", encodeMsg({ t: "hello", v, as }));
    expect(w.status.host.some((s) => s.startsWith(why))).toBe(true);
    expect(w.host.seatOf("g9")).toBeUndefined();
  });

  it("reports a desync when a peer's hash disagrees", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "DESYNC", seats: TABLE });
    w.host.intent({ type: "startBlind" });
    tickAll(w);
    /* Move the guest's state behind the session's back — a bug the relay
       cannot see any other way — and let the next trick end. */
    w.state.guest = { ...w.state.guest, rngState: w.state.guest.rngState + 1 };
    for (let i = 0; i < 60 && !w.status.host.some((s) => s.startsWith("desync")); i++) {
      tickAll(w);
      if (w.state.host.screen) break;
      const p = waiting(w.state.host);
      if (p === null) break;
      (p === GUEST_SEAT ? w.guest : w.host).intent(move(w.state.host, p));
    }
    expect(w.status.host.some((s) => s.startsWith("desync"))).toBe(true);
  });

  it("refuses a request carrying the clock's action, or the window's own", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "REQ", seats: TABLE });
    w.host.intent({ type: "startBlind" });
    const n = w.host.count();
    /* Not reachable from guestSession, which drops both before sending — this
       is a hand-crafted message, which is the only kind the door is for. */
    w.host.receive("g1", encodeMsg({ t: "req", a: { type: "aiPlay" } }));
    w.host.receive("g1", encodeMsg({ t: "req", a: { type: "openModal", modal: "rules" } }));
    expect(w.host.count()).toBe(n);
    expect(w.state.host.modal).toBeNull();
  });

  it("turns away a peer that arrives after the game has started", () => {
    const w = wire();
    w.host.intent({ type: "newRun", seed: "LATE", seats: TABLE });
    w.host.receive("g2", encodeMsg({ t: "hello", v: NET_VERSION, as: "player" }));
    /* g2 was never given a chair, so it is turned away for that first; the one
       that has one is refused on the count alone. */
    expect(w.status.host.some((s) => s.startsWith("nochair"))).toBe(true);
    w.host.join("g2", 3);
    w.host.receive("g2", encodeMsg({ t: "hello", v: NET_VERSION, as: "player" }));
    expect(w.status.host.some((s) => s.startsWith("late"))).toBe(true);
    expect(w.host.seatOf("g2")).toBeUndefined();
  });

  /* Which door refused it, and not "the link dropped". Nothing on the wire
     says why a `bye` was sent, so the guest reads the one thing it does know:
     whether it had been welcomed. Before the welcome the host turned it away —
     a version out of step, a chair it was not offered, or, most likely, a
     match already under way. After the welcome the session was real. */
  it.each([
    ["turned away at the door", false, "refused"],
    ["cut off after the welcome", true, "dropped"],
  ] as const)("tells a guest %s which it was", (_label, welcomed, says) => {
    const status: string[] = [];
    const guest = guestSession({
      as: "player",
      send: () => {},
      apply: () => {},
      onStatus: (s) => status.push(s),
      onSeat: () => {},
    });
    if (welcomed) guest.receive(encodeMsg({ t: "welcome", v: NET_VERSION, seat: 1 }));
    expect(guest.welcomed()).toBe(welcomed);
    guest.receive(encodeMsg({ t: "bye" }));
    expect(status.at(-1)).toBe(says);
  });

  /* The line is the welcome and not the seat: a shared table is welcomed
     holding no chair, so a seat test would call every one of its byes a
     refusal for the whole match. */
  it("calls a welcomed shared table's bye a drop, chair or no chair", () => {
    const status: string[] = [];
    const table = guestSession({
      as: "table",
      send: () => {},
      apply: () => {},
      onStatus: (s) => status.push(s),
      onSeat: () => {},
    });
    table.receive(encodeMsg({ t: "welcome", v: NET_VERSION, seat: null }));
    expect(table.seat()).toBeNull();
    table.receive(encodeMsg({ t: "bye" }));
    expect(status.at(-1)).toBe("dropped");
  });

  it("reports a peer that leaves", () => {
    const w = wire();
    w.host.leave("g1");
    expect(w.status.host.some((s) => s.startsWith("dropped"))).toBe(true);
    expect(w.host.seatOf("g1")).toBeUndefined();
  });
});

/* ==================== the shared table ====================
   A peer that holds no chair: it draws the board, hashes like everybody else
   and sends nothing at all. Three layers refuse its actions independently —
   guestSession before the wire, guestMay at the host's door, and the
   components that draw no button — and these are the first two. */
describe("a peer with no chair", () => {
  it("is welcomed with no seat and kept in the broadcast set", () => {
    const w = wire();
    /* No join(): the shared table's invitation reserves no chair, so the host
       has heard nothing about this peer before its hello. */
    w.host.receive("t1", encodeMsg({ t: "hello", v: NET_VERSION, as: "table" }));
    expect(w.host.seatOf("t1")).toBeNull();
    expect(w.status.host).toContain("live:t1");
    expect(w.guests).toContainEqual(["t1", "table", null]);
  });

  it("hears every numbered action although it holds no chair", () => {
    const seen: string[] = [];
    const state = { host: createRun("BOOT"), table: createRun("BOOT") };
    const table = guestSession({
      as: "table",
      send: (_peer, text) => seen.push(text),
      apply: (a) => {
        state.table = gameReducer(state.table, a);
      },
      onStatus: () => {},
      onSeat: () => {},
    });
    const host = hostSession({
      send: (_peer, text) => table.receive(text),
      apply: (a) => {
        state.host = gameReducer(state.host, a);
      },
      onStatus: () => {},
      onGuest: () => {},
    });
    host.receive("t1", encodeMsg({ t: "hello", v: NET_VERSION, as: "table" }));
    host.intent({ type: "newRun", seed: "WATCHED", seats: TABLE });
    host.intent({ type: "startBlind" });
    expect(state.table.seed).toBe("WATCHED");
    expect(hashState(state.table)).toBe(hashState(state.host));
  });

  /* The chairless invitation is the shared table's, so a device that answers
     it and asks for a chair is a device that said the wrong thing at the door
     — refused rather than seated at a chair the lobby never set aside. */
  it("is refused if it asks to be seated as a player", () => {
    const w = wire();
    w.host.receive("g9", encodeMsg({ t: "hello", v: NET_VERSION, as: "player" }));
    expect(w.status.host.some((s) => s.startsWith("nochair"))).toBe(true);
    expect(w.status.host.some((s) => s === "live:g9")).toBe(false);
    expect(w.host.seatOf("g9")).toBeUndefined();
    expect(w.guests.map(([p]) => p)).not.toContain("g9");
  });

  /* A chair's invitation answered "table" is honoured too: the joining
     device's answer is authoritative in both directions, and the lobby is told
     which chair it may hand back to the game. */
  it("takes a chair's invitation without taking the chair", () => {
    const w = wire();
    w.host.join("g3", 3);
    w.host.receive("g3", encodeMsg({ t: "hello", v: NET_VERSION, as: "table" }));
    expect(w.host.seatOf("g3")).toBeNull();
    expect(w.guests).toContainEqual(["g3", "table", 3]);
  });
});

describe("the shared table's own session", () => {
  const sent: string[] = [];
  const applied: Action[] = [];
  const table = guestSession({
    as: "table",
    send: (_peer, text) => sent.push(text),
    apply: (a) => applied.push(a),
    onStatus: () => {},
    onSeat: () => {},
  });

  /* A seat action and a flow action: the flow one is what a null check written
     after `scope === "flow"` would let through, and Continue on a board nobody
     at that screen is playing is exactly the move this refuses. */
  it("sends no request for a seat action or a flow action", () => {
    sent.length = 0;
    table.intent({ type: "playCard", p: 1, uid: "u1" });
    table.intent({ type: "nextDeal" });
    table.intent({ type: "startChallenge", id: "race" });
    table.intent({ type: "aiPlay" });
    expect(sent.filter((s) => s.includes('"req"'))).toEqual([]);
    expect(sent).toEqual([]);
  });

  /* Its own window still works: the rules panel is a local action, and
     somebody at the shared screen looking a rule up is what it is for. */
  it("still applies the window's own", () => {
    applied.length = 0;
    table.intent({ type: "openModal", modal: "rules" });
    expect(applied).toEqual([{ type: "openModal", modal: "rules" }]);
  });

  it("says hello as the table", () => {
    sent.length = 0;
    table.hello();
    expect(sent.map((s) => JSON.parse(s) as unknown)).toEqual([
      { t: "hello", v: NET_VERSION, as: "table" },
    ]);
  });
});

/* ==================== three peers, one deal ====================
   The host, a player at seat 1 and a shared table with no chair at all, each
   running its own reducer over the same numbered stream. What the table owes
   is the whole of the mode: the same state after every trick, and not one
   request sent over a whole deal. */
describe("a race watched from the shared table", () => {
  type Three = {
    state: { host: GameState; guest: GameState; table: GameState };
    host: HostSession;
    guest: GuestSession;
    table: GuestSession;
    reqs: number;
    endTricks: number;
  };

  function wireThree(): Three {
    const state = {
      host: createRun("BOOT"),
      guest: createRun("BOOT"),
      table: createRun("BOOT"),
    };
    const counts = { reqs: 0, endTricks: 0 };
    const at: { host?: HostSession; guest?: GuestSession; table?: GuestSession } = {};

    const host = hostSession({
      send: (peer, text) => (peer === "g1" ? at.guest?.receive(text) : at.table?.receive(text)),
      apply: (a) => {
        state.host = gameReducer(state.host, a);
        if (a.type === "endTrick") counts.endTricks++;
      },
      onStatus: () => {},
      onGuest: () => {},
    });
    const guest = guestSession({
      as: "player",
      send: (_peer, text) => at.host?.receive("g1", text),
      apply: (a) => {
        state.guest = gameReducer(state.guest, a);
      },
      onStatus: () => {},
      onSeat: () => {},
    });
    const table = guestSession({
      as: "table",
      send: (_peer, text) => {
        if (text.includes('"req"')) counts.reqs++;
        at.host?.receive("t1", text);
      },
      apply: (a) => {
        state.table = gameReducer(state.table, a);
      },
      onStatus: () => {},
      onSeat: () => {},
    });
    at.host = host;
    at.guest = guest;
    at.table = table;
    host.join("g1", GUEST_SEAT);
    guest.hello();
    /* No join for the table: its invitation reserved no chair. */
    table.hello();

    return {
      state,
      host,
      guest,
      table,
      get reqs() {
        return counts.reqs;
      },
      get endTricks() {
        return counts.endTricks;
      },
    };
  }

  it("stays in step over a whole deal and sends nothing", () => {
    const w = wireThree();
    /* Every peer's clock runs, exactly as useGameLoop runs it: the host's
       becomes a numbered action and the other two are dropped where they are
       classified. */
    const ticks = () => {
      for (let i = 0; i < 4000; i++) {
        for (const [g, s] of [
          [w.state.guest, w.guest],
          [w.state.table, w.table],
        ] as const) {
          const t = nextTick(g);
          if (t) s.intent(t.action);
        }
        const h = nextTick(w.state.host);
        if (!h) return;
        w.host.intent(h.action);
        expect(hashState(w.state.table)).toBe(hashState(w.state.host));
      }
      throw new Error("the clock did not settle");
    };

    w.host.intent({ type: "startChallenge", id: "race", seed: "WATCHED", seats: TABLE });
    expect(w.state.table.challenge).toBe("race");

    for (let i = 0; i < 400 && !w.state.host.screen; i++) {
      ticks();
      if (w.state.host.screen) break;
      const p = waiting(w.state.host);
      if (p === null) throw new Error(`nobody to act in phase ${w.state.host.phase}`);
      (p === GUEST_SEAT ? w.guest : w.host).intent(move(w.state.host, p));
      expect(hashState(w.state.table)).toBe(hashState(w.state.host));
    }

    expect(w.state.host.screen).not.toBeNull();
    expect(hashState(w.state.table)).toBe(hashState(w.state.host));
    expect(dehydrate(w.state.table)).toEqual(dehydrate(w.state.host));
    /* Nothing at all left the table over a whole deal. */
    expect(w.reqs).toBe(0);
    /* Vacuity guards: a deal that never reached a trick, or a table that
       applied nothing, would agree trivially. */
    expect(w.endTricks).toBeGreaterThan(11);
    expect(w.state.table.trickNo).toBeGreaterThan(5);
    expect(w.state.table.raceScores).toEqual(w.state.host.raceScores);
  });
});

/* ==================== going back to your own run ====================
   Three chairs with a person in each, and each of those people was doing
   something else before the match: a half-played roguelike of their own, parked
   whole by startChallenge. There is no shared answer to "what were you doing
   before", so leaving a match cannot be a broadcast action — it is one window's
   decision about its own private run, which is what `local` says here. */
describe("leaving a match", () => {
  const THREE: GameState["seats"] = ["human", "human", "human", "ai"];
  const SEAT_A: Seat = 1;
  const SEAT_B: Seat = 2;
  const LEAVE: Action = { type: "leaveChallenge" };

  type Peers = {
    state: { host: GameState; a: GameState; b: GameState };
    host: HostSession;
    a: GuestSession;
    b: GuestSession;
    status: { host: string[]; a: string[]; b: string[] };
    /* Requests each guest sent, and numbered actions each guest was sent. */
    reqs: { a: number; b: number };
    acts: { a: number; b: number };
  };

  /* Booted from three different seeds, so the three parked runs really are
     three different runs — which is the whole reason this action cannot be
     resolved twice. */
  function wireLeave(): Peers {
    const state = {
      host: createRun("HOSTRUN"),
      a: createRun("GUESTARUN"),
      b: createRun("GUESTBRUN"),
    };
    const status = { host: [] as string[], a: [] as string[], b: [] as string[] };
    const reqs = { a: 0, b: 0 };
    const acts = { a: 0, b: 0 };
    const at: { host?: HostSession; a?: GuestSession; b?: GuestSession } = {};

    const host = hostSession({
      send: (peer, text) => {
        const who = peer === "ga" ? "a" : "b";
        if (text.includes('"act"')) acts[who]++;
        (peer === "ga" ? at.a : at.b)?.receive(text);
      },
      apply: (a) => {
        state.host = gameReducer(state.host, a);
        at.host?.localHash(hashState(state.host));
      },
      onStatus: (s, info) => status.host.push(info ? `${s}:${info}` : s),
      onGuest: () => {},
    });
    const guest = (who: "a" | "b", peer: string) =>
      guestSession({
        as: "player",
        send: (_p, text) => {
          if (text.includes('"req"')) reqs[who]++;
          at.host?.receive(peer, text);
        },
        apply: (act) => {
          state[who] = gameReducer(state[who], act);
          at[who]?.localHash(hashState(state[who]));
        },
        onStatus: (s, info) => status[who].push(info ? `${s}:${info}` : s),
        onSeat: () => {},
      });
    const a = guest("a", "ga");
    const b = guest("b", "gb");
    at.host = host;
    at.a = a;
    at.b = b;
    host.join("ga", SEAT_A);
    host.join("gb", SEAT_B);
    a.hello();
    b.hello();

    return { state, host, a, b, status, reqs, acts };
  }

  const inRace = (w: Peers) => {
    w.host.intent({ type: "startChallenge", id: "race", seed: "LEAVERACE", seats: THREE });
    /* One numbered action put all three into the same race: the state is built
       from the action's own fields, so the three prior runs left nothing behind
       but their parked selves. */
    expect(w.host.count()).toBe(1);
    for (const g of [w.state.a, w.state.b]) expect(hashState(g)).toBe(hashState(w.state.host));
  };

  it("is one window's own decision and reaches nobody else", () => {
    const w = wireLeave();
    inRace(w);
    const before = hashState(w.state.host);
    const n = w.host.count();
    const sent = { ...w.reqs };
    const seen = { ...w.acts };

    w.a.intent(LEAVE);

    /* Nothing left guest A, and the host sequenced nothing. */
    expect(w.reqs).toEqual(sent);
    expect(w.host.count()).toBe(n);
    /* The two peers still at the table are where they were, and still agree. */
    expect(hashState(w.state.host)).toBe(before);
    expect(hashState(w.state.b)).toBe(before);
    /* Guest A is back in its own parked run, which is why the three hashes
       cannot all be equal: that run is nobody else's. */
    expect(w.state.a.seed).toBe("GUESTARUN");
    expect(w.state.a.challenge).toBeNull();
    expect(w.state.a.menu).toBe("start");
    expect(hashState(w.state.a)).not.toBe(before);
    expect(w.status.host.filter((s) => s.startsWith("desync"))).toEqual([]);

    /* The host's mirror, in the same case: the sequencer leaving numbers and
       broadcasts nothing either, and the two guests stay exactly where they
       are. In the window it also hangs up, which is what stops it sequencing
       its own restored run's ticks into a race the others are still playing. */
    w.host.intent(LEAVE);
    expect(w.host.count()).toBe(n);
    expect(w.acts).toEqual(seen);
    expect(w.state.host.seed).toBe("HOSTRUN");
    expect(w.state.host.menu).toBe("start");
    expect(hashState(w.state.b)).toBe(before);
    expect(w.state.b.challenge).toBe("race");
  });

  /* The bug this classification replaces, pinned so it cannot be quietly
     undone: both halves of it, the divergence and the silence. */
  it("diverged in silence when it was broadcast instead", () => {
    const w = wireLeave();
    inRace(w);

    /* Exactly what a v4 build did: the host numbered the leave and every peer
       applied it — against its own private parked run. Applied through the
       reducer by hand, because the classification now refuses to send it. */
    w.state.host = gameReducer(w.state.host, LEAVE);
    w.state.b = gameReducer(w.state.b, LEAVE);
    expect(w.state.host.seed).toBe("HOSTRUN");
    expect(w.state.b.seed).toBe("GUESTBRUN");
    expect(hashState(w.state.host)).not.toBe(hashState(w.state.b));

    /* And nothing told anybody. hashing.due is set by endTrick alone, and both
       peers now sit on menu "start", where nextTick returns null — so no
       further trick ever resolves and the hash is never compared again. */
    expect(nextTick(w.state.host)).toBeNull();
    expect(nextTick(w.state.b)).toBeNull();
    w.host.localHash(hashState(w.state.host));
    w.b.localHash(hashState(w.state.b));
    expect(w.status.host.filter((s) => s.startsWith("desync"))).toEqual([]);

    /* Vacuity guard for the silence: the comparison itself works. One more
       numbered action — endTrick, the one that marks a hash due — and the same
       two states are reported as the divergence they are. */
    w.host.intent({ type: "endTrick" });
    expect(w.status.host.filter((s) => s.startsWith("desync"))).not.toEqual([]);
  });
});
