import { describe, expect, it } from "vitest";
import { guestSeating, hostSeating, type GuestHost, type RoomEvents } from "./seating";
import { guestSession, hostSession, type GuestSession, type HostSession } from "./session";
import { NET_VERSION, encodeMsg, type GuestRole } from "./protocol";
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
  tables: GuestRole[];
  guests: Map<string, Guest>;
  arrive: (id: string, as?: GuestRole) => Guest;
  drop: (id: string) => void;
};

function table(open: Seat[]): Table {
  const state = { g: createRun("BOOT") };
  const status: string[] = [];
  const chairs: { seat: Seat; state: string }[] = [];
  /* Every peer the host welcomed with no chair at all. */
  const tables: GuestRole[] = [];
  const guests = new Map<string, Guest>();

  const host = hostSession({
    send: (peer, text) => guests.get(peer)?.events.onMessage(HOST, text),
    apply: (a) => {
      state.g = gameReducer(state.g, a);
    },
    onStatus: (s, info) => status.push(info ? `${s}:${info}` : s),
    /* The welcome is what says a chair is taken, here as in the window: the
       hello is what claims one, and the host still refuses a peer a version
       out of step, so an arrival is not an answer. A display claims none, and
       its `chair` comes back null. */
    onGuest: (_peer, as, chair) => {
      if (chair === null) {
        tables.push(as);
        return;
      }
      chairs.push({ seat: chair, state: as === "table" ? "table" : "connected" });
    },
  });
  const events = hostSeating(host, open, (seat) => chairs.push({ seat, state: "failed" }));

  const arrive = (id: string, as: GuestRole = "player"): Guest => {
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
      as,
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
    tables,
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

  /* The room is the way people will actually join, so it is the way a shared
     display joins: the same eight characters, and a chair claimed by nobody.
     A chair set aside for it would be a chair no player could take, which is
     why the hello and not the arrival is what claims one. */
  it("gives a shared display no chair, and the next player the lowest free one", () => {
    const t = table([1, 3]);
    const screen = t.arrive("tv", "table");
    const player = t.arrive("g1");

    /* Welcomed, and holding nothing. */
    expect(screen.status).toContain("live");
    expect(screen.seat.p).toBeNull();
    expect(t.host.seatOf("tv")).toBeNull();
    expect(t.tables).toEqual(["table"]);
    /* The chair it did not take is still the first one going. */
    expect(player.seat.p).toBe(1);
    expect(t.chairs).toEqual([{ seat: 1, state: "connected" }]);
  });

  /* And it keeps receiving the stream it holds no chair in — a peer for the
     hash like any other, which is the point of putting it in the broadcast
     set with no seat rather than outside it. */
  it("plays the numbered stream to a display as well as to the players", () => {
    const t = table([1, 3]);
    const screen = t.arrive("tv", "table");
    const player = t.arrive("g1");

    t.host.intent({ type: "newRun", seed: "ROOMSEED" });

    expect(screen.state.g.seed).toBe("ROOMSEED");
    expect(player.state.g.seed).toBe("ROOMSEED");
  });

  /* A full table is a full table whatever else is in the room: the display
     took no chair, so it cannot be what filled it. */
  it("turns away a player when the chairs are gone, with a display in the room", () => {
    const t = table([1]);
    t.arrive("tv", "table");
    t.arrive("g1");
    const spare = t.arrive("g2");

    expect(spare.status).toContain("dropped");
    expect(t.status).toContain("dropped:g2");
    expect(t.host.seatOf("g2")).toBeUndefined();
  });

  /* The claim is provisional, and this is why. The hello has to reserve a
     chair before hostSession can welcome the peer into it, but the host
     refuses a peer a version out of step — so without the release the chair
     would be held for a device that was never let in, and the next arrival
     would be told the table was full. */
  it("hands back a chair claimed by a peer the host then refused", () => {
    const t = table([1]);
    t.events.onMessage("old", encodeMsg({ t: "hello", v: NET_VERSION + 1, as: "player" }));

    expect(t.status).toContain("version:old");
    expect(t.host.seatOf("old")).toBeUndefined();
    expect(t.chairs).toEqual([]);
    /* And the chair is still on offer. */
    const next = t.arrive("g1");
    expect(next.seat.p).toBe(1);
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

  /* The sharpest case on this side. A display's seat is null for the whole
     match, so a seating that greeted "while I have no seat" would hello every
     later arrival — and the second hello, after the first action is numbered,
     is what the host refuses as `late`. It would throw the screen out of the
     match it was already showing. */
  it("greets no new peer once a display has been welcomed with no chair", () => {
    const t = table([1, 3]);
    const screen = t.arrive("tv", "table");
    t.host.intent({ type: "newRun", seed: "ROOMSEED" });
    t.status.length = 0;

    screen.events.onPeer("g2");

    expect(t.status).not.toContain("late:tv");
    expect(screen.status).not.toContain("dropped");
    expect(t.host.seatOf("tv")).toBeNull();
    /* Still in step: the stream it is applying did not stop. */
    expect(screen.state.g.seed).toBe("ROOMSEED");
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
