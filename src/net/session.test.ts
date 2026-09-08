import { describe, expect, it } from "vitest";
import { NET_VERSION, encodeMsg, hashState } from "./protocol";
import { guestSession, hostSession, type GuestSession, type HostSession } from "./session";
import { basicPolicy } from "../test/bot";
import { gameReducer } from "../game/reducer";
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
  hold: (on: boolean) => void;
  flush: () => void;
};

function wire(): Wired {
  const state = { host: createRun("BOOT"), guest: createRun("BOOT") };
  const status = { host: [] as string[], guest: [] as string[] };
  const sent = { toGuest: 0, toHost: 0 };
  const held = { on: false, toGuest: [] as string[], toHost: [] as string[] };
  const at: { host?: HostSession; guest?: GuestSession } = {};

  const host = hostSession({
    send: (_peer, text) => {
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
  });
  const guest = guestSession({
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

    expect(w.state.host.screen?.kind).toBe("dealend");
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

/* The mode the lobby starts, played across the relay: the race is what the
   transport is for, and it is the one flow action that builds a whole state
   out of nothing but its own fields. Two humans, one at each peer, and thirteen
   tricks between them. */
describe("a race over the relay", () => {
  it("is started by one action and played into the same state", () => {
    const w = wire();
    w.host.intent({ type: "startChallenge", id: "race", seed: "WIRERACE", seats: TABLE });
    expect(w.state.guest.challenge).toBe("race");
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
    expect(w.state.host.challenge).toBe("race");
    expect(w.state.guest.challenge).toBe("race");
    expect(hashState(w.state.guest)).toBe(hashState(w.state.host));
    expect(w.state.guest.raceScores).toEqual(w.state.host.raceScores);
    expect(w.status.host.filter((s) => s.startsWith("desync"))).toEqual([]);
    expect(w.status.guest.filter((s) => s.startsWith("desync"))).toEqual([]);
    /* Vacuity guard: a deal that never reached a trick would agree trivially. */
    expect(w.state.host.trickNo).toBeGreaterThan(5);
    expect(w.host.count()).toBeGreaterThan(50);
  });
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
  it("refuses a peer on another version at the door", () => {
    const w = wire();
    w.host.receive("g1", encodeMsg({ t: "hello", v: NET_VERSION + 1 }));
    expect(w.status.host.some((s) => s.startsWith("version"))).toBe(true);
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
    w.host.receive("g2", encodeMsg({ t: "hello", v: NET_VERSION }));
    /* g2 was never given a chair, so it is not even a peer; the one that has
       one is refused on the count alone. */
    w.host.join("g2", 3);
    w.host.receive("g2", encodeMsg({ t: "hello", v: NET_VERSION }));
    expect(w.status.host.some((s) => s.startsWith("late"))).toBe(true);
    expect(w.host.seatOf("g2")).toBeUndefined();
  });

  it("reports a peer that leaves", () => {
    const w = wire();
    w.host.leave("g1");
    expect(w.status.host.some((s) => s.startsWith("dropped"))).toBe(true);
    expect(w.host.seatOf("g1")).toBeUndefined();
  });
});
