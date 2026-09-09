import { describe, expect, it } from "vitest";
import { guestSeating, hostSeating, type GuestHost, type RoomEvents } from "./seating";
import { guestSession, hostSession, type GuestSession, type HostSession } from "./session";
import { gameReducer } from "../game/reducer";
import { createRun } from "../game/state";
import type { GameState, Seat } from "../game/types";

/* A room with no room in it. Every peer here is a pair of `RoomEvents` and a
   session, and a "send" is a direct call into the other side's onMessage —
   which is exactly what Trystero does once its relay has introduced the two
   browsers. The introductions themselves are room.ts's, and are checked
   there.

   What this file is for is the decisions: which chair an arrival gets, what a
   full table answers, and how a guest works out which of the peers it can see
   is the host. */

const HOST = "h";

type Guest = {
  events: RoomEvents;
  session: GuestSession;
  state: { g: GameState };
  status: string[];
  seat: { p: Seat | null };
  found: GuestHost;
};

type Table = {
  host: HostSession;
  events: RoomEvents;
  state: { g: GameState };
  status: string[];
  chairs: { seat: Seat; state: string }[];
  guests: Map<string, Guest>;
  arrive: (id: string) => Guest;
  drop: (id: string) => void;
};

function table(open: Seat[]): Table {
  const state = { g: createRun("BOOT") };
  const status: string[] = [];
  const chairs: { seat: Seat; state: string }[] = [];
  const guests = new Map<string, Guest>();

  const host = hostSession({
    send: (peer, text) => guests.get(peer)?.events.onMessage(HOST, text),
    apply: (a) => {
      state.g = gameReducer(state.g, a);
    },
    onStatus: (s, info) => status.push(info ? `${s}:${info}` : s),
    /* A room's chair is set aside on the arrival itself, so the welcome has
       nothing left to say about which chair it was — what it carries here is
       the role, and every arrival in this file is a player. */
    onGuest: () => {},
  });
  const events = hostSeating(host, open, (seat, s) => chairs.push({ seat, state: s }));

  const arrive = (id: string): Guest => {
    const gs = { g: createRun("BOOT") };
    const gstatus: string[] = [];
    const found: GuestHost = { id: null };
    const seat = { p: null as Seat | null };
    const session = guestSession({
      send: (_peer, text) => {
        /* Before the host has answered, a guest sends to everybody it can
           see; here there is only ever the host to see. */
        events.onMessage(id, text);
      },
      apply: (a) => {
        gs.g = gameReducer(gs.g, a);
      },
      onStatus: (s) => gstatus.push(s),
      as: "player",
      onSeat: (p) => {
        seat.p = p;
      },
    });
    const gevents = guestSeating(session, found, () => gstatus.push("hostgone"));
    const rec: Guest = { events: gevents, session, state: gs, status: gstatus, seat, found };
    guests.set(id, rec);
    /* Both sides see the arrival, the way onPeerJoin fires on both. */
    events.onPeer(id);
    gevents.onPeer(HOST);
    return rec;
  };

  return {
    host,
    events,
    state,
    status,
    chairs,
    guests,
    arrive,
    drop: (id) => events.onDrop(id),
  };
}

describe("a room's seating, on the host", () => {
  it("gives arrivals the open chairs in seat order", () => {
    const t = table([1, 3]);
    const a = t.arrive("g1");
    const b = t.arrive("g2");

    expect(a.seat.p).toBe(1);
    expect(b.seat.p).toBe(3);
    expect(t.chairs).toEqual([
      { seat: 1, state: "connected" },
      { seat: 3, state: "connected" },
    ]);
  });

  it("turns away an arrival there is no chair for", () => {
    const t = table([1]);
    t.arrive("g1");
    const spare = t.arrive("g2");

    /* Told, rather than left waiting for a welcome that will never come. */
    expect(spare.seat.p).toBeNull();
    expect(spare.status).toContain("dropped");
    expect(t.status).toContain("dropped:g2");
    expect(t.host.seatOf("g2")).toBeUndefined();
  });

  it("frees the chair of a peer that leaves, and nothing else", () => {
    const t = table([1, 3]);
    t.arrive("g1");
    t.arrive("g2");
    t.chairs.length = 0;
    t.drop("g1");

    expect(t.chairs).toEqual([{ seat: 1, state: "failed" }]);
    expect(t.status).toContain("dropped:g1");
    expect(t.host.seatOf("g1")).toBeUndefined();
    expect(t.host.seatOf("g2")).toBe(3);
  });

  it("seats a peer whose first message outran its arrival", () => {
    const t = table([1, 3]);
    const gs = { g: createRun("BOOT") };
    const seat = { p: null as Seat | null };
    const session = guestSession({
      send: (_peer, text) => t.events.onMessage("g9", text),
      apply: (a) => {
        gs.g = gameReducer(gs.g, a);
      },
      onStatus: () => {},
      as: "player",
      onSeat: (p) => {
        seat.p = p;
      },
    });
    const events = guestSeating(session, { id: null }, () => {});
    t.guests.set("g9", { events, session, state: gs, status: [], seat, found: { id: null } });

    /* No onPeer on the host's side at all: the hello is the first this
       seating hears of the peer. */
    session.hello();

    expect(seat.p).toBe(1);
    expect(t.host.seatOf("g9")).toBe(1);
  });

  it("numbers an action once and every guest applies it", () => {
    const t = table([1, 3]);
    const a = t.arrive("g1");
    const b = t.arrive("g2");

    t.host.intent({ type: "newRun", seed: "ROOMSEED" });

    expect(t.host.count()).toBe(1);
    expect(t.state.g.seed).toBe("ROOMSEED");
    expect(a.state.g.seed).toBe("ROOMSEED");
    expect(b.state.g.seed).toBe("ROOMSEED");
  });
});

describe("a room's seating, on a guest", () => {
  it("learns which peer is the host from the first message back", () => {
    const t = table([1]);
    const a = t.arrive("g1");
    expect(a.found.id).toBe(HOST);
  });

  it("ignores a message from a peer that is not the host", () => {
    const t = table([1]);
    const a = t.arrive("g1");
    const before = a.state.g.seed;

    /* Another guest, forging the stream. A guest's relay is a star: only the
       host's numbered actions move its state. */
    a.events.onMessage("g2", JSON.stringify({ t: "act", n: 1, a: { type: "newRun", seed: "X" } }));

    expect(a.state.g.seed).toBe(before);
  });

  it("greets a new peer only while it has no seat", () => {
    const t = table([1]);
    const a = t.arrive("g1");
    t.host.intent({ type: "newRun", seed: "ROOMSEED" });

    /* A second hello now would be refused as late and cost this guest the
       seat it already has. */
    a.events.onPeer("g2");

    expect(a.seat.p).toBe(1);
    expect(t.status).not.toContain("late:g1");
    expect(a.status).not.toContain("late");
  });

  it("reports a drop only when it is the host that dropped", () => {
    const t = table([1]);
    const a = t.arrive("g1");

    a.events.onDrop("g2");
    expect(a.status).not.toContain("hostgone");

    a.events.onDrop(HOST);
    expect(a.status).toContain("hostgone");
  });
});
