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
  it("refuses a peer on another version at the door", () => {
    const w = wire();
    w.host.receive("g1", encodeMsg({ t: "hello", v: NET_VERSION + 1, as: "player" }));
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
    w.host.receive("g2", encodeMsg({ t: "hello", v: NET_VERSION, as: "player" }));
    /* g2 was never given a chair, so it is turned away for that first; the one
       that has one is refused on the count alone. */
    expect(w.status.host.some((s) => s.startsWith("nochair"))).toBe(true);
    w.host.join("g2", 3);
    w.host.receive("g2", encodeMsg({ t: "hello", v: NET_VERSION, as: "player" }));
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
