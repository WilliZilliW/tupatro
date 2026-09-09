import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NET_VERSION, encodeMsg } from "../net/protocol";
import { createRun } from "../game/state";
import { useNetGame } from "./useNetGame";
import type { LinkEvents } from "../net/rtc";

/* ============================ the host's own wiring ========================
   net/session.ts is tested with no browser at all, and net/rtc.ts is the one
   file that names RTCPeerConnection. What is left between them is this hook:
   which link callback moves which piece of lobby state. That is where the
   shared table's Start gate lives, so it is tested by stubbing the door and
   firing its callbacks by hand.

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

/* Stable across renders: the hook hashes the state it is handed on every
   render, and a fresh run each time would say the board changed. */
const RUN = createRun("TABLEGATE");

async function hosting() {
  links.length = 0;
  const dispatch = vi.fn();
  const { result } = renderHook(() => useNetGame(RUN, dispatch));
  /* The switch is read inside invite(), so it has to be set first. With the
     four default chairs — one "me", three the game's — the shared table's is
     the only link built. */
  await act(async () => {
    result.current.setWantTable(true);
  });
  await act(async () => {
    result.current.invite(0);
  });
  expect(links).toHaveLength(1);
  return { result, link: links[0] };
}

/* One open chair and no shared table, so the chair's is the only link built.
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
  expect(links).toHaveLength(1);
  return { result, link: links[0] };
}

const hello = (as: "player" | "table", v: number = NET_VERSION) => encodeMsg({ t: "hello", v, as });

describe("the shared table's invitation", () => {
  it("is not connected because a data channel opened", async () => {
    const { result, link } = await hosting();
    expect(result.current.tableInvite?.state).toBe("waiting");
    /* A device answered — and that is all this says. It has not yet said
       whether it is a display or a player, and Start's one precondition is a
       display. */
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
     read "connected" after that: Start would then be enabled with no display
     present, and there is no reconnect to rescue one that arrives late. */
  it("stays unanswered when the device asks for a chair instead", async () => {
    const { result, link } = await hosting();
    act(() => {
      link.events.onOpen();
      link.events.onMessage(hello("player"));
    });
    expect(result.current.tableInvite?.state).toBe("waiting");
    expect(result.current.status).toBe("nochair");
  });

  /* Off by default, and read at invite() rather than at connect time: a host
     who does not want a shared display builds no fifth peer connection. */
  it("is not built at all unless the host asked for one", async () => {
    links.length = 0;
    const { result } = renderHook(() => useNetGame(RUN, vi.fn()));
    await act(async () => {
      result.current.invite(0);
    });
    expect(links).toHaveLength(0);
    expect(result.current.tableInvite).toBeNull();
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
