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
}));

/* Stable across renders: the hook hashes the state it is handed on every
   render, and a fresh run each time would say the board changed. */
const RUN = createRun("TABLEGATE");

async function hosting() {
  links.length = 0;
  const dispatch = vi.fn();
  const { result } = renderHook(() => useNetGame(RUN, dispatch));
  await act(async () => {
    result.current.invite(0);
  });
  /* The four default chairs are one "me" and three the game's, so no chair is
     invited and the shared table's is the only link built. */
  expect(links).toHaveLength(1);
  return { result, link: links[0] };
}

/* One open chair, and so two links: the chair's and the display's, in that
   order — invite() walks the chairs before it builds the chairless one.
   setChair runs before invite(), which reads the chairs as it plans them. */
async function hostingChair() {
  links.length = 0;
  const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
  await act(async () => {
    result.current.setChair(1, "open");
  });
  await act(async () => {
    result.current.invite(0);
  });
  expect(links).toHaveLength(2);
  return { result, link: links[0], tableLink: links[1] };
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
    expect(links).toHaveLength(1);
    expect(result.current.tableInvite?.state).toBe("waiting");
    expect(result.current.tableInvite?.code).toBe("INVITE");
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

/* What the lobby's Start turns its two pieces into: the chairs become `seats`
   and the picker decides the action's own type. Offline there is no session
   between the click and the reducer, so the hook's own dispatch is what the
   spy sees — nothing numbered, and no seed stamped. */
describe("what the lobby's Start dispatches", () => {
  it("sends newRun with the chair plan and no seed for the roguelike", () => {
    const dispatch = vi.fn<(a: Action) => void>();
    const { result } = renderHook(() => useNetGame(RUN, dispatch));
    /* The default, and the plan New game has always produced: me at my own
       chair and the game at the other three. */
    expect(result.current.match).toBe("run");
    act(() => {
      result.current.start();
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "newRun",
      seats: ["human", "ai", "ai", "ai"],
    });
    /* Not merely absent from the expectation: a seed of any kind — an empty
       string included — is a different run from the one the reducer draws. */
    expect(dispatch.mock.calls[0][0]).not.toHaveProperty("seed");
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
    expect(result.current.tableInvite?.state).toBe("connected");
    /* Nothing is gathering, so the line is complete the moment it exists. */
    expect(result.current.tableInvite?.complete).toBe(true);
    /* And it claimed no chair on the way in. */
    expect(result.current.seatsFor()).toEqual(["ai", "ai", "ai", "ai"]);
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
});
