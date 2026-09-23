import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NET_VERSION, encodeMsg } from "../net/protocol";
import { createRun } from "../game/state";
import { useNetGame } from "./useNetGame";
import type { Action } from "../game/actions";
import type { LinkEvents } from "../net/rtc";
import type { RoomEvents } from "../net/seating";

/* ============================ the host's own wiring ========================
   net/session.ts is tested with no browser at all, and net/rtc.ts is the one
   file that names RTCPeerConnection. What is left between them is this hook:
   which link callback moves which piece of lobby state. That is what decides
   whether the lobby goes on offering an invitation or reports it answered, so
   it is tested by stubbing the door and firing its callbacks by hand.

   The stub is deliberately dumb — it records the callbacks and the strings
   sent — because the question here is not what WebRTC does but what the lobby
   believes. */
const links: Array<{ events: LinkEvents; sent: string[] }> = [];

/* The answer the stubbed link refuses to take. Any other string is accepted. */
const REJECT = "ALREADY-CONNECTED";

vi.mock("../net/rtc", () => ({
  hostLink: (_lan: boolean, events: LinkEvents) => {
    const held = { events, sent: [] as string[] };
    links.push(held);
    return Promise.resolve({
      id: `link${links.length}`,
      code: () => "INVITE",
      gathered: Promise.resolve(),
      /* A real link's take() rejects as well as refusing: handed an answer
         when its peer is already connected it reaches setRemoteDescription on
         a stable connection, which throws. The sentinel is how that half is
         reached without a browser. */
      take: (code: string) =>
        code === REJECT ? Promise.reject(new Error("stable")) : Promise.resolve({ ok: true }),
      send: (text: string) => held.sent.push(text),
      close: () => {},
    });
  },
  guestLink: () => Promise.resolve({ ok: false, why: "empty" }),
}));

/* The other route's door, stubbed the same way and for the same question: a
   room introduces its peers over a relay this file has no business reaching,
   and what is under test is which of its events moves which piece of lobby
   state. */
const rooms: Array<{ events: RoomEvents; sent: Array<[string, string]> }> = [];

vi.mock("../net/room", () => ({
  openRoom: (code: string, _lan: boolean, ev: RoomEvents) => {
    const held = { events: ev, sent: [] as Array<[string, string]> };
    rooms.push(held);
    return {
      code,
      self: "self",
      send: (peer: string, text: string) => held.sent.push([peer, text]),
      peers: () => [],
      close: () => {},
    };
  },
  /* The hook imports this alongside openRoom, so the mock has to carry it
     too or every enterRoom case throws on an undefined import. */
  normalizeRoomCode: (code: string) => code.trim().toUpperCase(),
}));

/* Stable across renders: the hook hashes the state it is handed on every
   render, and a fresh run each time would say the board changed. */
const RUN = createRun("TABLEGATE");

/* Taking a chair opens the other three, so a code swap builds four links: one
   per chair the host did not take, in engine order, and the display's last.
   `link` here is the display's, which is what this file is mostly about. */
async function hosting() {
  links.length = 0;
  const dispatch = vi.fn();
  const { result } = renderHook(() => useNetGame(RUN, dispatch));
  await act(async () => {
    result.current.invite(0);
  });
  expect(links).toHaveLength(4);
  return { result, link: links[3] };
}

/* The same four links, named from a chair's end: the first is chair 1's — the
   first chair that is not the host's — and the last is the chairless one. */
async function hostingChair() {
  links.length = 0;
  const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
  await act(async () => {
    result.current.invite(0);
  });
  expect(links).toHaveLength(4);
  return { result, link: links[0], tableLink: links[3] };
}

const hello = (as: "player" | "table", v: number = NET_VERSION) => encodeMsg({ t: "hello", v, as });

describe("the shared table's invitation", () => {
  it("is not connected because a data channel opened", async () => {
    const { result, link } = await hosting();
    expect(result.current.tableInvite?.state).toBe("waiting");
    /* A device answered — and that is all this says. It has not yet said
       whether it is a display or a player, and settled() would stop drawing
       the code the moment this read "connected". */
    act(() => {
      link.events.onOpen();
    });
    expect(result.current.tableInvite?.state).toBe("waiting");
  });

  it("is connected when the display says it is one", async () => {
    const { result, link } = await hosting();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("table"));
    });
    expect(result.current.tableInvite?.state).toBe("connected");
  });

  /* The chairless invitation is the display's, so a device that answers it and
     asks for a chair is refused at the door with `nochair`. The block must not
     read "connected" after that: settled() would hide the code, the QR and the
     Connect for an invitation nobody took, leaving the host no way to offer it
     again and a line saying a display is in. */
  it("stays unanswered when the device asks for a chair instead", async () => {
    const { result, link } = await hosting();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("player"));
    });
    expect(result.current.tableInvite?.state).toBe("waiting");
    expect(result.current.status).toBe("nochair");
  });

  /* No switch, no question: a screen could always answer a chair's code and
     say "table", so asking first decided only whether the host was shown a
     code reserving no chair. It is built every time now, and Start no longer
     waits for it. */
  it("is built for every host", async () => {
    links.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    await act(async () => {
      result.current.invite(0);
    });
    /* Three chairs and the display: the chairless invitation is the one extra
       link every code swap pays for, and it is built whether or not anybody
       ever asks the host for it. */
    expect(links).toHaveLength(4);
    expect(result.current.tableInvite?.state).toBe("waiting");
    expect(result.current.tableInvite?.code).toBe("INVITE");
  });

  /* tableHere follows the welcome, not the data channel, the same rule
     onGuest already carries: a device that opens the chairless link and is
     refused with bye and nochair must not raise it — a chair marked
     "connected" by the channel alone is exactly the stall the welcome-only
     rule exists to avoid, and the flag would be the same mistake one level
     up. */
  it("marks tableHere on the welcome, not on the link opening", async () => {
    const { result, link } = await hosting();
    expect(result.current.tableHere).toBe(false);
    act(() => {
      link.events.onOpen();
    });
    expect(result.current.tableHere).toBe(false);
    act(() => {
      link.events.onMessage(hello("table"));
    });
    expect(result.current.tableHere).toBe(true);
  });

  it("never raises tableHere for a device refused with nochair", async () => {
    const { result, link } = await hosting();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("player"));
    });
    expect(result.current.status).toBe("nochair");
    expect(result.current.tableHere).toBe(false);
  });

  /* Both links exist now, so which is which stops being incidental: the lobby
     draws one block per chair and one for the display, and a host handed the
     display's code for a chair would seat a player at a link that reserves
     none. The chairs are walked first inside invite(). */
  it("is built after the chairs', and each hello reaches its own", async () => {
    const { result, link, tableLink } = await hostingChair();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("player"));
    });
    expect(result.current.chairs[1].state).toBe("connected");
    expect(result.current.tableInvite?.state).toBe("waiting");

    act(() => {
      tableLink.events.onOpen();
      tableLink.events.onMessage(hello("table"));
    });
    expect(result.current.tableInvite?.state).toBe("connected");
    /* And the display took no chair on the way in. */
    expect(result.current.seatsFor()).toEqual(["human", "human", "ai", "ai"]);
  });
});

/* A chair's invitation is the same gate with a worse ending, because a chair
   that reads "connected" is not only a Start button: seatsFor() maps it to
   "human", and nextTick returns null for a human seat for ever. So the
   welcome marks a chair too, and the data channel marks nothing. */
describe("a chair's invitation", () => {
  it("is not connected because a data channel opened", async () => {
    const { result, link } = await hostingChair();
    expect(result.current.chairs[1].state).toBe("waiting");
    act(() => {
      link.events.onOpen();
    });
    expect(result.current.chairs[1].state).toBe("waiting");
    expect(result.current.seatsFor()[1]).toBe("ai");
  });

  it("is connected when the host has welcomed the player", async () => {
    const { result, link } = await hostingChair();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("player"));
    });
    expect(result.current.chairs[1].state).toBe("connected");
    expect(result.current.seatsFor()[1]).toBe("human");
  });

  /* The case the channel-open gate got wrong: hostSession refuses a peer one
     version out of step with `bye`, and it neither closes the link nor gives
     the chair back, so onClose never fires. A chair left "connected" there is
     a human seat with nobody behind it — Start enabled, and the deal stalled
     at the first player-gated phase with no error to show for it. */
  it("stays unanswered when the device is a version out of step", async () => {
    const { result, link } = await hostingChair();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("player", NET_VERSION + 1));
    });
    expect(result.current.chairs[1].state).toBe("waiting");
    expect(result.current.status).toBe("version");
    expect(result.current.seatsFor()[1]).toBe("ai");
  });

  /* The joining device's answer is authoritative in both directions: a display
     that answers a chair's code holds no chair, and the game plays it. */
  it("is the game's again when a display answers it", async () => {
    const { result, link } = await hostingChair();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("table"));
    });
    expect(result.current.chairs[1].state).toBe("table");
    expect(result.current.seatsFor()[1]).toBe("ai");
  });

  /* The lobby stops drawing Connect for a chair that has been answered, so
     this is the layer under that: an answer handed to a link whose peer is
     already here reaches setRemoteDescription on a stable connection, which
     rejects. The host is told, and — since Vitest fails a run on an unhandled
     rejection — this case is also what holds the rejection handler in place. */
  it("says so rather than throwing when the browser refuses an answer", async () => {
    const { result, link } = await hostingChair();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("table"));
    });
    await act(async () => {
      result.current.connect(1, REJECT);
    });
    expect(result.current.problem).toBe("refused");
    /* A code the browser does take clears it again. */
    await act(async () => {
      result.current.connect(1, "G1WHATEVER");
    });
    expect(result.current.problem).toBeNull();
  });
});

/* Rock-Paper-Scissors seats only rpsSeats' own pair, chairs 0 and 1, so the
   code swap must not build an invitation chairs 2 and 3 could never be
   admitted to. */
describe("planFor for Rock-Paper-Scissors", () => {
  async function hostingRps() {
    links.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    act(() => {
      result.current.setMatch("rps");
    });
    await act(async () => {
      result.current.invite(0);
    });
    /* Chair 1's link and the chairless display's — never chairs 2 or 3's. */
    expect(links).toHaveLength(2);
    return { result, link: links[0], tableLink: links[1] };
  }

  it("opens chair 1 alone, forcing chairs 2 and 3 non-open", async () => {
    const { result } = await hostingRps();
    expect(result.current.chairs[0].kind).toBe("me");
    expect(result.current.chairs[1].kind).toBe("open");
    expect(result.current.chairs[2].kind).toBe("ai");
    expect(result.current.chairs[3].kind).toBe("ai");
  });

  it("answers seatsFor() human/ai/ai/ai before chair 1 connects, human/human/ai/ai after", async () => {
    const { result, link } = await hostingRps();
    expect(result.current.seatsFor()).toEqual(["human", "ai", "ai", "ai"]);
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("player"));
    });
    expect(result.current.seatsFor()).toEqual(["human", "human", "ai", "ai"]);
  });

  /* Every other mode is unaffected: this is the same four-link plan as
     before, opening every chair the host does not hold. */
  it("leaves every other mode's plan alone", async () => {
    links.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    await act(async () => {
      result.current.invite(0);
    });
    expect(links).toHaveLength(4);
    expect(result.current.chairs.map((c) => c.kind)).toEqual(["me", "open", "open", "open"]);
  });

  /* planFor reads the mode once, at invite(), and the picker is drawn beside
     Start as well — so a plan can outlive the mode it was built for. seatsFor
     asks again on the click that names the seats, which is what stops a
     four-chair swap that was switched to this mode from seating two people who
     then hold no cards at all: rpsSeats wants *exactly* two humans and falls
     back to the solo pairing given three. */
  it("seats two even when the mode is chosen after a four-chair plan was built", async () => {
    links.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    await act(async () => {
      result.current.invite(0);
    });
    for (const link of links.slice(0, 3)) {
      act(() => {
        link.events.onOpen();
        link.events.onMessage(hello("player"));
      });
    }
    expect(result.current.seatsFor()).toEqual(["human", "human", "human", "human"]);
    act(() => {
      result.current.setMatch("rps");
    });
    expect(result.current.seatsFor()).toEqual(["human", "human", "ai", "ai"]);
    /* And back again: the chairs themselves are untouched, so the connections
       the swap already made are still worth four humans to any other mode. */
    act(() => {
      result.current.setMatch("tuppi");
    });
    expect(result.current.seatsFor()).toEqual(["human", "human", "human", "human"]);
  });
});

/* What the lobby's Start turns its two pieces into: the chairs become `seats`
   and the picker decides which match mode the action names. Offline there is
   no session between the click and the reducer, so the hook's own dispatch is
   what the spy sees — nothing numbered, and no seed stamped. */
describe("what the lobby's Start dispatches", () => {
  /* The roguelike is not startable from here at all any more: the lobby is
     multiplayer-only, the single-player screen is the roguelike's door, and
     `match` is a MatchId so the roguelike is a compile error, not a branch. */
  it("starts the default match mode and never a run", () => {
    const dispatch = vi.fn<(a: Action) => void>();
    const { result } = renderHook(() => useNetGame(RUN, dispatch));
    expect(result.current.match).toBe("tupatro");
    act(() => {
      result.current.start();
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "startChallenge",
      id: "tupatro",
      seed: undefined,
      seats: ["human", "ai", "ai", "ai"],
    });
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain("newRun");
  });

  it("sends startChallenge for a match mode, carrying the same chairs", () => {
    const dispatch = vi.fn<(a: Action) => void>();
    const { result } = renderHook(() => useNetGame(RUN, dispatch));
    /* Two acts, because the picker and Start are two clicks: start reads the
       mode through a ref written while rendering. */
    act(() => {
      result.current.setMatch("tuppi");
    });
    act(() => {
      result.current.start();
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "startChallenge",
      id: "tuppi",
      seed: undefined,
      seats: ["human", "ai", "ai", "ai"],
    });
  });
});

/* The route the code swap was made to agree with, and it is untouched: a room
   has one code for the whole table, so a display types the same eight
   characters as everybody else and there is no invitation to build for it. Its
   line is filled by the welcome, which is what a chair set aside on the hello
   rather than on the arrival makes possible. */
describe("a room's shared table", () => {
  it("has no invitation of its own, and is welcomed by its hello", async () => {
    links.length = 0;
    rooms.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    act(() => {
      result.current.setName("Host");
    });
    await act(async () => {
      result.current.openRoom();
    });
    expect(links).toHaveLength(0);
    expect(result.current.tableInvite).toBeNull();

    act(() => {
      rooms[0].events.onMessage("p1", hello("table"));
    });
    /* A room has no chair-shaped invitation for a display to answer, so the
       welcome moves tableHere and nothing else — tableInvite stays null for
       the whole life of this session, since openRoom's onGuest writes it no
       longer. */
    expect(result.current.tableHere).toBe(true);
    expect(result.current.tableInvite).toBeNull();
    /* And it claimed no chair on the way in. */
    expect(result.current.seatsFor()).toEqual(["ai", "ai", "ai", "ai"]);
  });

  it("marks tableHere from onTables alone, and lowers it again when the display leaves", async () => {
    links.length = 0;
    rooms.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    act(() => result.current.setName("Host"));
    await act(async () => result.current.openRoom());
    expect(result.current.tableHere).toBe(false);

    act(() => {
      rooms[0].events.onMessage("p1", hello("table"));
    });
    expect(result.current.tableHere).toBe(true);
    expect(result.current.tableInvite).toBeNull();

    /* The display's own drop: the same onTables dep, fired the other way. */
    act(() => {
      rooms[0].events.onDrop("p1");
    });
    expect(result.current.tableHere).toBe(false);
  });

  it("admits a named player unassigned and lets the host choose both chairs", async () => {
    rooms.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    act(() => result.current.setName("Host"));
    await act(async () => result.current.openRoom());

    act(() => {
      rooms[0].events.onMessage(
        "p1",
        encodeMsg({ t: "hello", v: NET_VERSION, as: "player", name: "Guest" }),
      );
    });
    expect(result.current.players).toEqual([
      { id: "host", name: "Host", seat: null },
      { id: "p1", name: "Guest", seat: null },
    ]);
    expect(result.current.canStart).toBe(false);

    act(() => {
      result.current.assignPlayer("host", 1);
      result.current.assignPlayer("p1", 3);
    });
    expect(result.current.canStart).toBe(true);
    expect(result.current.seat).toBe(1);
    expect(result.current.seatsFor()).toEqual(["ai", "human", "ai", "human"]);
  });

  /* Choosing the mode is a seating decision here, not only a label on Start:
     the chair-assignment list stops drawing a select for the chairs
     Rock-Paper-Scissors cannot use, so a player left sitting in one could not
     be moved again short of removing the peer — while canStart stayed satisfied
     and Start seated two people who then held no cards at all. The chairs the
     mode does not play are freed on the click instead, which puts the room back
     in the state lobby.needAssignments and lobby.rpsTwo together describe. */
  it("frees the chairs Rock-Paper-Scissors does not play when the mode is chosen", async () => {
    rooms.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    act(() => result.current.setName("Host"));
    await act(async () => result.current.openRoom());

    act(() => {
      for (const id of ["p1", "p2", "p3"]) {
        rooms[0].events.onMessage(
          id,
          encodeMsg({ t: "hello", v: NET_VERSION, as: "player", name: id }),
        );
      }
    });
    act(() => {
      result.current.assignPlayer("host", 0);
      result.current.assignPlayer("p1", 1);
      result.current.assignPlayer("p2", 2);
      result.current.assignPlayer("p3", 3);
    });
    expect(result.current.canStart).toBe(true);
    expect(result.current.seatsFor()).toEqual(["human", "human", "human", "human"]);

    act(() => {
      result.current.setMatch("rps");
    });
    expect(result.current.players.map((p) => p.seat)).toEqual([0, 1, null, null]);
    /* Two unassigned players now, so Start refuses until the host removes them
       or the mode moves back — which is the honest state for a mode that has
       no chair for them. */
    expect(result.current.canStart).toBe(false);
    expect(result.current.seatsFor()).toEqual(["human", "human", "ai", "ai"]);
  });

  /* And every other mode leaves the roster exactly as the host placed it. */
  it("frees nothing when the mode chosen seats four", async () => {
    rooms.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    act(() => result.current.setName("Host"));
    await act(async () => result.current.openRoom());
    act(() => {
      rooms[0].events.onMessage(
        "p1",
        encodeMsg({ t: "hello", v: NET_VERSION, as: "player", name: "Guest" }),
      );
    });
    act(() => {
      result.current.assignPlayer("host", 0);
      result.current.assignPlayer("p1", 3);
    });
    act(() => {
      result.current.setMatch("tuppi");
    });
    expect(result.current.players.map((p) => p.seat)).toEqual([0, 3]);
    expect(result.current.canStart).toBe(true);
  });
});

describe("entering a room", () => {
  it("normalises a typed code before opening the room, the path a player walks", async () => {
    rooms.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    act(() => result.current.setName("Guest"));
    await act(async () => {
      result.current.enterRoom("  aBcD1234 ", "player");
    });

    expect(rooms).toHaveLength(1);
    expect(result.current.room).toBe("ABCD1234");
  });
});
